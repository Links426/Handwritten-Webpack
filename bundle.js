const fs = require('fs')
const path = require("path")
const parser = require("@babel/parser")
const traverse = require("@babel/traverse").default

const babel = require("@babel/core")
const getModuleInfo = (file) => {
    const body = fs.readFileSync(file, 'utf-8')
    const ast = parser.parse(body, {
        // 解析es模块
        sourceType: 'module'
    })

    // 遍历ast
    const deps = {}
    traverse(ast, {
        ImportDeclaration({ node }) {
            const dirname = path.dirname(file)
            let aftfix = file.slice(file.lastIndexOf('.'), file.length)
            const abspath = './' + path.join(dirname, node.source.value + aftfix)
            deps[node.source.value] = abspath
        }
    })
    // 使用babel，将es6专为es5
    const { code } = babel.transformFromAst(ast, null, {
        presets: ["@babel/preset-env"]
    })
    const moduleInfo = { file, deps, code }
    return moduleInfo

}

// 递归获取依赖

const parseModules = (file) => {
    const entry = getModuleInfo(file)
    const temp = [entry]

    const depsGraph = {}

    for (let i = 0; i < temp.length; i++) {
        const deps = temp[i].deps
        if (deps) {
            for (const key in deps) {
                if (deps.hasOwnProperty(key)) {
                    temp.push(getModuleInfo(deps[key]))
                }
            }
        }
    }

    temp.forEach(moduleInfo => {
        depsGraph[moduleInfo.file] = {
            deps: moduleInfo.deps,
            code: moduleInfo.code
        }
    })


    return depsGraph
}

const bundle = (file) => {
    const depsGraph = JSON.stringify(parseModules(file))
    return `(function (graph) {
        function require(file) {
            function absRequire(relPath) {
                return require(graph[file].deps[relPath])
            }
            var exports = {};
            (function (require,exports,code) {
                eval(code)
            })(absRequire,exports,graph[file].code)
            return exports
        }
        require('${file}')
    })(${depsGraph})`

}

const content = bundle('./src/index.js')
if (fs.existsSync('./dist')) {
    fs.rmSync('./dist', { recursive: true });
}
fs.mkdirSync('./dist');
fs.writeFileSync('./dist/bundle.js', content)


