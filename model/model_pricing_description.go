package model

import (
	"github.com/QuantumNous/new-api/common"
)

// ModelPricingDescription is shared by previews and snapshot entries. It
// describes effective prices without adding persisted settings.
type ModelPricingDescription struct {
	Effective      PricingValues        `json:"effective,omitempty"`
	BillingDetails LegacyBillingDetails `json:"billing_details"`
}

type LegacyPricingRule struct {
	Condition  string  `json:"condition"`
	Multiplier float64 `json:"multiplier"`
}

// LegacyBillingDetails is display-only. It explains how a fixed per-call
// price is settled: charged once per image, or adjusted by request rules.
type LegacyBillingDetails struct {
	ImageCount   bool                `json:"image_count,omitempty"`
	RequestRules []LegacyPricingRule `json:"request_rules,omitempty"`
}

func ResolveLegacyBillingDetails(name string, effective PricingValues) LegacyBillingDetails {
	details := LegacyBillingDetails{}
	if _, fixed := effective["ModelPrice"]; !fixed {
		return details
	}
	details.ImageCount = common.IsImageGenerationModel(name)
	details.RequestRules = legacyDallePricingRules(name)
	return details
}
