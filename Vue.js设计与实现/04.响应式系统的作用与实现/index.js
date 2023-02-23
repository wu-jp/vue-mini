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
  const effectsToRun = new Set()

  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发执行的副作用函数和与当前执行的副作用函数相同，则不触发
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })

  effectsToRun.forEach(effectFn => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

let activeEffect
const effectStack = [] // 栈

// effect 函数用于注册副作用函数，将副作用函数 fn 赋值给 activeEffect
function effect(fn, options = {}) {
  const effectFn = () => {
    // 清除
    cleanup(effectFn)
    // 当调用 effect 注册副作用函数时，将副作用函数赋值给activeEffect
    activeEffect = effectFn
    // 在调用副作用函数之前将副作用函数压入栈中
    effectStack.push(effectFn)
    // 将 fn 的执行结果存储到res中
    const res = fn()
    // 在副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]

    // 将res 作为 effectFn 的返回值
    return res
  }
  // 将 options 挂载到 effectFn 上
  effectFn.options = options
  effectFn.deps = []

  // 非lazy时，才执行
  if (!options.lazy) {
    // 执行副作用函数
    effectFn()
  }

  // 将副作用函数作为返回值
  return effectFn()
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

// 定义一个任务队列
const jobQueue = new Set()
// 使用 Promise.resolve() 创建一个promise实例，我们用它将一个任务添加到微队列
const p = Promise.resolve()
// 一个标识代表是否在刷新队列
let isFlushing = false
function flushJob() {
  // 如果正在刷新，则什么都不做
  if (isFlushing) return

  // 代表正在刷新
  isFlushing = true

  // 在微任务队列中刷新 jobQueue 任务
  p.then(() => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    // 结束后重置 isFlusing
    isFlushing = false
  })
}

effect(() => {
  document.body.innerHTML = obj.ok ? obj.text : 'not'
})

setTimeout(() => {
  obj.ok = false
}, 1000)


function traverse(value, seen = new Set()) {
  // 如果读取的值时一个原始值，或者已被读取过，那么直接返回
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 将数据添加到seen中，代表遍历读取过，避免循环引用
  seen.add(value)

  // 加上value是一个对象，使用 for..in 读取对象的每个值，并递归调用 traverse 进行处理
  for (const k in value) {
    traverse(value[key], seen)
  }

  return value
}

function watch(source, cb) {
  let getter
  if (typeof source === 'function') {
    getter = source
  }
  // 否则按照原来的实现调用 traverse 递归调用
  else {
    getter = () => traverse(source)
  }

  // 定义新值和旧值
  let oldValue, newValue
  // 使用effect 注册副作用函数，开启lazy选项，并把返回值存储到effectFn 中以便后续手动调用
  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler() {
        // 重新执行副作用函数
        newValue = effectFn()
        // 将旧值和新增作为回调函数的参数
        cb(newValue, oldValue)
        // 更新旧值，不然下次会得到错误的旧值
        oldValue = newValue
      }
    }
  )
  // 手动调用副作用函数，拿到的值就是旧值
  oldValue = effectFn()
}

function watch(source, cb, options = {}) {
  let getter
  if (typeof source === 'function') {
    getter = source
  }
  // 否则按照原来的实现调用 traverse 递归调用
  else {
    getter = () => traverse(source)
  }

  let oldValue, newValue

  // cleanup 用来清理存储用户注册的的函数
  let cleanup

  function onInvalidate(fn) {
    cleanup = fn
  }

  const job = () => {
    newValue = effectFn()
    if (cleanup) {
      cleanup()
    }
    cb(newValue, oldValue, onInvalidate)
    oldValue = newValue
  }

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
        // 如果flush 为 post，将其放到微任务队列中执行
        if (options.flush === 'post') {
          const p = Promise.resolve()
          p.then(job)
        } else {
          job()
        }
      }
    }
  )

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}


