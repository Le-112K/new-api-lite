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
	"strings"
)

// 渠道模型名标准化：渠道「拉取模型列表」时，把拉到的候选名按元数据名称
// 规则匹配到标准模型。匹配结果由渠道表单消费——保存渠道时把标准名追加进
// models、{标准名: 原名} 合并进 model_mapping，客户端即可用标准名调用。
// 这里只做匹配（只读元数据），不改渠道。

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

// StandardMatch 是单个候选模型名的匹配结果。Mapped=false 表示没有元数据
// 归属，名字保持原样（Standard==Name），不产生映射建议。
type StandardMatch struct {
	Name     string `json:"name"`
	Standard string `json:"standard"`
	Rule     string `json:"rule,omitempty"`
	Mapped   bool   `json:"mapped"`
}

// MatchStandardModels 对候选模型名列表逐个求归属。
func MatchStandardModels(names []string) []StandardMatch {
	cleaned := make([]string, 0, len(names))
	seen := make(map[string]struct{}, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		cleaned = append(cleaned, name)
	}
	if len(cleaned) == 0 {
		return []StandardMatch{}
	}

	var records []Model
	if err := DB.Select("model_name", "name_rule").Find(&records).Error; err != nil || len(records) == 0 {
		// 元数据为空或查询失败：全部视为无归属，不阻断拉取流程。
		out := make([]StandardMatch, 0, len(cleaned))
		for _, name := range cleaned {
			out = append(out, StandardMatch{Name: name, Standard: name})
		}
		return out
	}
	resolved := resolveModelMetadata(records, cleaned)

	out := make([]StandardMatch, 0, len(cleaned))
	for _, name := range cleaned {
		if meta := resolved[name]; meta != nil && meta.ModelName != name {
			out = append(out, StandardMatch{
				Name:     name,
				Standard: meta.ModelName,
				Rule:     nameRuleLabel(meta.NameRule),
				Mapped:   true,
			})
			continue
		}
		out = append(out, StandardMatch{Name: name, Standard: name})
	}
	return out
}
