import router from "@adonisjs/core/services/router"
import server from "@adonisjs/core/services/server"

server.errorHandler(() => import("#exceptions/handler"))

// Serves `public/`, where `kirana-style build` and `kirana-style dev` write the stylesheet.
server.use([() => import("@adonisjs/static/static_middleware")])

router.use([])
