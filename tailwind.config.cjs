module.exports = {
  content: ['./src/index.html', './src/client.html'],
  theme: {
    extend: {
      colors: {
        'v-magenta': '#EB088A',
        'v-cobalt': '#313CFF',
        'v-violet': '#8A25C9',
        'v-turquoise': '#48C0D9',
        'v-tangerine': '#FF9E00',
        'v-lime': '#CFF933',
        'v-grey': '#E9E8E8',
      },
      fontFamily: {
        sans: ['"Open Sans"', 'sans-serif'],
        heading: ['Inter', 'sans-serif'],
      },
    },
  },
};
