/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './features/**/*.{js,ts,tsx}'],

    presets: [require('nativewind/preset')],
    theme: {
        extend: {
            colors: {
                primary: '#4096ff',
                danger: '#ff4d4f',
                regular: '#333333',
                secondary: '#666666',
                description: '#999999',
            },
        },
    },
    plugins: [],
};
