const bucket = new WeakMap()
// 用一个全局变量存储被注册的副作用函数
let activeEffect
// 栈，用来保持副作用函数嵌套时不出错
let effectStack = []

// 用于依赖收集
export function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn

    effectStack.push(effectFn)

    const res = fn()

    effectStack.pop()

    activeEffect = effectStack[effectStack.length - 1]

    return res
  }

  effectFn.options = options

  effectFn.deps = []

  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

export class ReactiveEffect {
  constructor(fn, options) {
    this.fn = fn
    this.options = options
  }

  run() {
    const effectFn = () => {
      cleanup(effectFn)
      activeEffect = effectFn

      effectStack.push(effectFn)

      const res = fn()

      activeEffect = effectStack[effectStack.length - 1]

      return res
    }

    effectFn.options = this.options

    effectFn.deps = []

    if (!this.options.lazy) {
      effectFn()
    }
  }
}

// 用于清理副作用
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }

  effectFn.deps.length = 0
}


export function track(target, key) {
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

// 为 trigger 函数添加第四个值，即新值 newVal
export function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effects = depsMap.get(key)

  const effectsToRun = new Set()



  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })


  // 如果操作的目标对象是数组，并修改了数组长度
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  // 非数组；只有当操作为 ‘ADD’ 或者 ‘DELETE’ 时，才触发 ITERATE_KEY 相关的依赖重新执行
  else if (type === 'ADD' || type === 'DELETE') {
    const iterateEffects = depsMap.get(ITERATE_KEY)
    // 将于 ITERATE_KEY 相关的副作用函数也添加到 effectTORun
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }


  effectsToRun.forEach(effectFn => {
    // 如果一个副作用函数存在调度器，则调用调度器，并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}
