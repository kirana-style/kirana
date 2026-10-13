import "@kirana-style/core/stylesheet.css"
import { bootstrapApplication } from "@angular/platform-browser"
import { provideFileRouter } from "@analogjs/router"

import { App } from "./app/app"

bootstrapApplication(App, { providers: [provideFileRouter()] })
