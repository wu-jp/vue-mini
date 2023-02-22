const data = {
  ok: true,
  text: 'hello world'
}

const bucket = new WeakMap()



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
  activeEffect.deps.push(deps)
}

// 在set 拦截函数内调用 trigger 函数触发变化
function trigger(target, key) {
  const depsMap = bucket.get(target)

  if (!depsMap) return

  const effects = depsMap.get(key)

  // effects && effects.forEach(fn => fn())

  const effectsToRun = new Set(effects)
  effectsToRun.forEach(effectFn => {
    return effectFn()
  })
}

let activeEffect
const effectStack = [] // 栈

// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn) {
  const effectFn = () => {
    // 清除
    cleanup(effectFn)
    // 当调用 effect 注册副作用函数时，将副作用函数赋值给activeEffect
    activeEffect = effectFn
    // 在调用副作用函数之前将副作用函数压入栈中
    effectStack.push(effectFn)
    fn()
    // 在副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.deps = []
  effectFn()
}

function cleanup(effectFn) {
  // console.log('effectFn', effectFn.deps)
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    console.log('effectFn', deps)
    deps.delete(effectFn)
  }

  effectFn.deps.length = 0
}

effect(() => {
  document.body.innerHTML = obj.ok ? obj.text : 'not'
})

setTimeout(() => {
  obj.ok = false
}, 1000)
