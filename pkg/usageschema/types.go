// Package usageschema holds the shared usage-schema types used by billing and
// pricing. They originally lived in the task plugin runtime, which was removed
// during the new-api streamlining (二开精简); the structs are kept so persisted
// pricing records keep decoding.
package usageschema

// LocalizedText is a locale-keyed display string map (BCP 47 tags → text).
type LocalizedText map[string]string

// UsageFieldSchema declares how one usage fact is validated before it can
// influence billing. Numeric facts use one of the host-owned canonical units;
// boolean facts are flags; enum facts constrain non-numeric pricing selectors.
type UsageFieldSchema struct {
	Type        string                   `json:"type,omitempty"`
	Unit        string                   `json:"unit,omitempty"`
	UnitLabel   LocalizedText            `json:"unitLabel,omitempty"`
	Enum        []string                 `json:"enum,omitempty"`
	Description LocalizedText            `json:"description,omitempty"`
	EnumLabels  map[string]LocalizedText `json:"enumLabels,omitempty"`
}

// UsageExample is a display-only pricing sample: a labeled complete vector
// over usageSchema. It never participates in billing.
type UsageExample struct {
	Label string         `json:"label"`
	Facts map[string]any `json:"facts"`
}
