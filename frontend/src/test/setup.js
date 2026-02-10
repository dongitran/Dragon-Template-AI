import '@testing-library/jest-dom';

// Mock window.matchMedia for Ant Design responsive components
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => { },
    }),
});

// Mock ResizeObserver for Ant Design layout components
class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.ResizeObserver = ResizeObserver;

// Mock getComputedStyle for Ant Design
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt, pseudoElt) => {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return {
        ...style,
        getPropertyValue: (prop) => style.getPropertyValue(prop) || '',
    };
};
