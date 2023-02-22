const data = {
  text: 'hello world'
}

const bucket = new WeakMap()

let activeEffect

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
  }
})

// 在get拦截函数中内调用track函数追踪变化
function track(target, key) {
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
}

// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const effects = depsMap.get(key)

  effects && effects.forEach(fn => fn())
}


// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn) {
  activeEffect = fn
  // 执行副作用函数
  fn()
}

effect(() => {
  console.log('effect run')
  document.body.innerHTML = obj.text
})

setTimeout(() => {
  obj.notExist = 'hello vue3'
}, 1000)
