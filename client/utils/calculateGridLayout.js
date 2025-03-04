const calculateGridLayout = (count) => {
    switch(count) {
        case 1: return { gridTemplate: '1fr / 1fr' };
        case 2: return { gridTemplate: '1fr / repeat(2, 1fr)' };
        case 3: return { gridTemplate: 'repeat(2, 1fr) / 1fr 1fr' };
        case 4: return { gridTemplate: 'repeat(2, 1fr) / repeat(2, 1fr)' };
        default: {
            const columns = Math.ceil(Math.sqrt(count));
            const rows = Math.ceil(count / columns);
            return { gridTemplate: `repeat(${rows}, 1fr) / repeat(${columns}, 1fr)` };
        }
    }
};

export default calculateGridLayout;
