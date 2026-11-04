import { BrowserWindow } from "electrobun/main"

new BrowserWindow({
  title: "Kirana on Electrobun",
  url: "views://mainview/index.html",
  frame: { width: 900, height: 700, x: 200, y: 200 },
})
