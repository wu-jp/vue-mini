import { track, trigger } from './effect.js'

// 定义一个 Map 实例，存储原始对象到代理对象的映射，用于解决同一个target对象被重复代理
const reactiveMap = new Map()

// 深响应
export function reactive(obj) {
  // 优先通过原始对象obj寻找之前创建的代理对象，如果找到了，直接返回已有的代理对象
  const existionProxy = reactiveMap.get(obj)
  if (existionProxy) return existionProxy

  // 否则，创建新的代理对象
  const proxy = createReactive(obj)
  // 存储到 Map 中，以避免重复创建
  reactiveMap.set(obj, proxy)

  return proxy
}

// 浅响应
export function shallowReactive(obj) {
  return createReactive(obj, true)
}

// 深只读
export function readonly(obj) {
  return createReactive(obj, false, true)
}

// 浅只读
export function shallowReadonly() {
  return createReactive(obj, true, true)
}

// 追踪普通对象的 for...in 操作，把ITERATE_KEY当作追踪的key
let ITERATE_KEY = Symbol()


// 重写数组方法，解决在代理对象中查找原始对象异常的问题
const arrayInstrumentations = {}

let methods = ['includes', 'indexOf', 'lastIndexOf']

methods.forEach(method => {
  const originMethod = Array.prototype[method]

  arrayInstrumentations[method] = function (...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到res
    let res = originMethod.apply(this, args)

    // 如果在代理对象中没有找到，通过 this.raw 拿到原始数组，再进行查找并更新res
    if (res === false || res === -1) {
      res = originMethod.apply(this.raw, args)
    }
    // 返回最终效果
    return res
  }
})

// 一个标记变量，代表是否进行追踪，默认为true，即允许追踪
let isShouldTrack = true

let changeLengthMethods = ['push', 'pop', 'shift', 'unshift', 'splice']
changeLengthMethods.forEach(method => {
  const originMethod = Array.prototype[method]
  arrayInstrumentations[method] = function (...args) {
    // 在调用原始方法前，先禁止追踪
    isShouldTrack = false

    // push 方法的默认行为
    let res = originMethod.apply(this, args)
    // 在调用原始方法后，恢复追踪
    isShouldTrack = true
    // 返回最终效果
    return res
  }
})


/**
 * 创建响应式数据
 * @param {*} obj 被代理的数据
 * @param {*} isShallow 表示是否为浅响应 默认值false
 * @param {*} isReadonly 表示是否为只可读 默认值false
 * @returns
 */
export function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      console.log('读取的key', key)

      // 代理对象可以通过 raw 属性访问原始数据，用于 set 操作时，判断 receiver 是否为target的代理对象
      if (key === 'raw') {
        return target
      }

      // 如果操作的目标是数组，并且 key 存在于 arrayInstrumentations 上，那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      // 只有非只读的，才需要建立响应联系 && 如果key的类型为symbol，则不进行追踪
      if (!isReadonly && typeof key !== 'symbol' && isShouldTrack) {
        console.log('收集依赖的key', key)
        track(target, key)
      }


      const res = Reflect.get(target, key, receiver)
      // 浅响应，直接返回原始值
      if (isShallow) {
        return res
      }

      // 处理深对象
      if (typeof res === 'object' && res !== null) {
        // 如果数据为只读，则调用 readonly 对值进行包装
        return isReadonly ? readonly(res) : reactive(res)
      }

      return res
    },
    set(target, key, newVal, receiver) {
      console.log('设置的key', key, newVal)
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      // 拿到旧的值
      const oldVal = target[key]

      // 如果属性不存在，说明是在添加新属性，否则是设置已有属性
      const type = Array.isArray(target)
        // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度
        // 如果是，则视为 SET 操作, 否则为 ADD 操作
        ? newVal < target.length ? 'SET' : 'ADD'  // 数组的情况下  key === 'length' ，newVal为设置的新长度
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'

      const res = Reflect.set(target, key, newVal, receiver)


      // target === receiver 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        // 当新值和旧值不相同时，才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 新增第四个参数，即触发响应的新增
          trigger(target, key, type, newVal, ITERATE_KEY)
        }
      }

      // 返回是否操作成功
      return res
    },

    // 通过 has 拦截函数实现 in 操作符
    has(target, key) {
      track(target, key)
      return Reflect.has(track, key)
    },

    // 通过ownKeys 拦截函数，拦截 for...in循环（包括普通对象和数组）
    ownKeys(target) {
      // 如果操作的目标 target 是数组，则使用 length 属性作为 key 并建立响应联系
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    },

    // 删除属性的代理
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      // 检查被操作的属性是否是对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      // 完成属性的删除
      const res = Reflect.deleteProperty(target, key)

      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    }

    // 其他拦截函数 ...
  })
}


