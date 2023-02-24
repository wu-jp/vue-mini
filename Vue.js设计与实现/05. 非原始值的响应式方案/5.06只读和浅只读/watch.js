import { effect } from "./effect.js"


export function watch(source, cb, options = {}) {
  // 定义getter
  let getter
  // 如果 source 是一个函数，说明用户传递的是一个getter，所有直接赋值就可以了
  if (typeof source === 'function') {
    getter = source
  } else {
    // 否则按照原来的实现调用 traverse 递归调用读取
    getter = () => traverse(source)
  }

  // 定义新值和旧值
  let oldValue, newValue

  // 存储用户通过onInvalidate函数注册的过期回调
  let cleanup
  function onInvalidate(fn) {
    // 将过期回调函数存储到 cleanup 中
    cleanup = fn
  }

  const job = () => {
    // 重新执行副作用函数
    newValue = effectFn()

    // 在调用回调函数cb之前，先调用过期回调
    if (cleanup) {
      cleanup()
    }

    // 当数据变化时，执行回调函数cb 将旧值和新增作为回调函数的参数
    cb(newValue, oldValue, onInvalidate)
    // 更新旧值，不然下次会得到错误的旧值
    oldValue = newValue
  }

  // 使用effect 注册副作用函数，开启lazy选项，并把返回值存储到effectFn 中以便后续手动调用
  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
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
    // 当 immediate 为 true 时立即执行job，从而触发回调函数
    job()
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn()
  }
}

function traverse(value, seen = new Set()) {
  // 如果读取的值时一个原始值，或者已被读取过，那么直接返回
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 将数据添加到seen中，代表遍历读取过，避免循环引用
  seen.add(value)
  // 加上value是一个对象，使用 for..in 读取对象的每个值，并递归调用 traverse 进行处理
  for (const k in value) {
    traverse(value[k], seen)
  }

  return value
}
