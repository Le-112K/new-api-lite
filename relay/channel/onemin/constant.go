package onemin

const ChannelName = "1min"

// ModelList is empty: 1min publishes no fixed catalogue, so the channel
// contributes nothing to the built-in model list. Models come from the
// channel's own model configuration, or from ModelListPath when upstream
// model sync is enabled.
var ModelList = []string{}
