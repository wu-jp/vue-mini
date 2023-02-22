const data = {
  text: 'hello world'
}

const bucket = new WeakMap()

let activeEffect

const obj = new Proxy(data, {
  get(target, key) {
    if (!activeEffect) return target[key]

    let depsMap = bucket.get(target)
    if (!depsMap) {
      bucket.set(target, (depsMap = new Map()))
    }

    let deps = depsMap.get(key)
    if (!deps) {
      depsMap.set(key, (deps = new Set()))
    }

    deps.add(activeEffect)

    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal

    const depsMap = bucket.get(target)

    if (!depsMap) return

    const effects = depsMap.get(key)

    effects && effects.forEach(fn => fn())
  }
})
