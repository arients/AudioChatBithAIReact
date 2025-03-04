const modelSettings = {
    voice: {
        options: [
            { value: "alloy", label: "Alloy" },
            { value: "ash", label: "Ash" },
            { value: "coral", label: "Coral" },
            { value: "echo", label: "Echo" },
            { value: "fable", label: "Fable" },
            { value: "onyx", label: "Onyx" },
            { value: "sage", label: "Sage" },
            { value: "shimmer", label: "Shimmer" }
        ],
        selected: "alloy",
    },
    communicationStyle: {
        options: [
            { label: "Select communication style...", value: "" },
            {
                label: "Friendly assistant 🤗",
                value: "Be polite and friendly, and help as clearly and positively as possible.",
            },
            {
                label: "Formal expert 📚",
                value: "Respond strictly to the point, using a professional tone.",
            },
            {
                label: "Joker 😆",
                value: "Respond with humour, adding jokes into the conversation.",
            },
            {
                label: "Short answers ✂️",
                value: "Respond as briefly as possible, no more than 2-3 sentences.",
            },
            {
                label: "Philosopher 🧠",
                value: "Think deeply, using metaphors and analogies.",
            },
            {
                label: "Gamer 🎮",
                value: "Communicate like a streamer, using gaming terminology and memes.",
            },
        ],
        selected: "",
    },
    instruction: "",
    temperature: 0.8,
};

export default modelSettings;
