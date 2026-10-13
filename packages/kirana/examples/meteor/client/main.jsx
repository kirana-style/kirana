import "@kirana-style/core/stylesheet.css"
import { createRoot } from "react-dom/client"
import { Meteor } from "meteor/meteor"
import { App } from "../imports/ui/App"

Meteor.startup(() => {
  createRoot(document.getElementById("react-target")).render(<App />)
})
