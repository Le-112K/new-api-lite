/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"gorm.io/gorm"
)

// 渠道别名归并：把渠道里的非标准模型名（gpt-4-turbo 等）收敛到元数据定义的
// 标准模型名下。建议只做「发现」，应用才真正改写渠道 models 与 model_mapping。

type ConsolidationItem struct {
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Alias       string `json:"alias"`
}

type ConsolidationSuggestion struct {
	StandardName string              `json:"standard_name"`
	Rule         string              `json:"rule"`
	Items        []ConsolidationItem `json:"items"`
}

type ConsolidationApplyItem struct {
	ChannelID int    `json:"channel_id"`
	Standard  string `json:"standard_name"`
	Alias     string `json:"alias_name"`
}

func nameRuleLabel(rule int) string {
	switch rule {
	case NameRulePrefix:
		return "prefix"
	case NameRuleSuffix:
		return "suffix"
	case NameRuleContains:
		return "contains"
	default:
		return "exact"
	}
}

// GetConsolidationSuggestions 扫描全部渠道模型名，按元数据名称规则找出
// 「别名 → 标准模型」的归并关系。别名等于标准名本尊的不产生建议。
func GetConsolidationSuggestions() ([]ConsolidationSuggestion, error) {
	var records []Model
	if err := DB.Select("id", "model_name", "name_rule").Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return []ConsolidationSuggestion{}, nil
	}
	var channels []Channel
	if err := DB.Select("id", "name", "models").Order("id").Find(&channels).Error; err != nil {
		return nil, err
	}

	names := make([]string, 0)
	for _, channel := range channels {
		names = append(names, channel.GetModels()...)
	}
	resolved := resolveModelMetadata(records, names)

	grouped := make(map[string][]ConsolidationItem)
	ruleOf := make(map[string]int)
	for _, channel := range channels {
		for _, alias := range channel.GetModels() {
			meta := resolved[alias]
			if meta == nil || meta.ModelName == alias {
				continue
			}
			grouped[meta.ModelName] = append(grouped[meta.ModelName], ConsolidationItem{
				ChannelID:   channel.Id,
				ChannelName: channel.Name,
				Alias:       alias,
			})
			ruleOf[meta.ModelName] = meta.NameRule
		}
	}

	standards := make([]string, 0, len(grouped))
	for standard := range grouped {
		standards = append(standards, standard)
	}
	sort.Strings(standards)
	suggestions := make([]ConsolidationSuggestion, 0, len(standards))
	for _, standard := range standards {
		items := grouped[standard]
		sort.Slice(items, func(i, j int) bool {
			if items[i].ChannelID != items[j].ChannelID {
				return items[i].ChannelID < items[j].ChannelID
			}
			return items[i].Alias < items[j].Alias
		})
		suggestions = append(suggestions, ConsolidationSuggestion{
			StandardName: standard,
			Rule:         nameRuleLabel(ruleOf[standard]),
			Items:        items,
		})
	}
	return suggestions, nil
}

// ApplyConsolidation 把勾选的归并写入渠道：models 增补标准名、model_mapping
// 增加 {标准名: 别名}（客户端请求标准名时中继转换为渠道真实名）。
// removeAliases 时从渠道模型列表移除别名（标准名本尊不受影响）。
// 返回实际改写的渠道数。
func ApplyConsolidation(items []ConsolidationApplyItem, removeAliases bool) (int, error) {
	if len(items) == 0 {
		return 0, errors.New("no consolidation items")
	}
	byChannel := make(map[int][]ConsolidationApplyItem)
	channelIDs := make([]int, 0)
	seenChannel := make(map[int]struct{})
	for _, item := range items {
		if item.ChannelID <= 0 {
			return 0, errors.New("invalid channel ID")
		}
		if strings.TrimSpace(item.Standard) == "" || strings.TrimSpace(item.Alias) == "" {
			return 0, errors.New("invalid consolidation item")
		}
		byChannel[item.ChannelID] = append(byChannel[item.ChannelID], item)
		if _, exists := seenChannel[item.ChannelID]; !exists {
			seenChannel[item.ChannelID] = struct{}{}
			channelIDs = append(channelIDs, item.ChannelID)
		}
	}
	sort.Ints(channelIDs)

	updated := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		var channels []Channel
		if err := lockForUpdate(tx).Select("id", "name", "models", "model_mapping").Where("id IN ?", channelIDs).Order("id").Find(&channels).Error; err != nil {
			return err
		}
		for _, channel := range channels {
			items := byChannel[channel.Id]
			models := channel.GetModels()
			modelSet := make(map[string]struct{}, len(models))
			for _, name := range models {
				modelSet[name] = struct{}{}
			}
			mapping := make(map[string]any)
			if raw := strings.TrimSpace(channel.GetModelMapping()); raw != "" {
				if err := json.Unmarshal([]byte(raw), &mapping); err != nil {
					return errors.New("channel " + channel.Name + " has an invalid model_mapping; fix it before consolidating")
				}
			}

			changed := false
			for _, item := range items {
				if _, exists := modelSet[item.Alias]; !exists {
					continue
				}
				if mapping[item.Standard] != item.Alias {
					mapping[item.Standard] = item.Alias
					changed = true
				}
				if _, exists := modelSet[item.Standard]; !exists {
					models = append(models, item.Standard)
					modelSet[item.Standard] = struct{}{}
					changed = true
				}
				if removeAliases && item.Alias != item.Standard {
					remaining := make([]string, 0, len(models))
					for _, name := range models {
						if name == item.Alias {
							delete(modelSet, item.Alias)
							continue
						}
						remaining = append(remaining, name)
					}
					models = remaining
					changed = true
				}
			}
			if !changed {
				continue
			}
			mappingJSON, err := json.Marshal(mapping)
			if err != nil {
				return err
			}
			mappingStr := string(mappingJSON)
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Updates(map[string]any{
				"models":        strings.Join(models, ","),
				"model_mapping": mappingStr,
			}).Error; err != nil {
				return err
			}
			channel.Models = strings.Join(models, ",")
			channel.ModelMapping = &mappingStr
			if err := channel.UpdateAbilities(tx); err != nil {
				return err
			}
			updated++
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return updated, nil
}
