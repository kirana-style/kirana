// Electrobun's scripts, as its Vite templates write them: Vite builds the view, then Electrobun the app.
export default {
  scripts: {
    dev: "hutch electrobun prepare && hutch pm exec -- vite build && hutch electrobun dev --watch",
    build:
      "hutch electrobun prepare && hutch pm exec -- vite build && hutch electrobun build --env=stable",
  },
}
