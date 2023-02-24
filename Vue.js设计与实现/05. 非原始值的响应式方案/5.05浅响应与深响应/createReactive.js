import { track, trigger } from './effect.js'

export function reactive(obj) {
  return createReactive(obj)
}

export function shallowReactive(obj) {
  return createReactive(obj, true)
}

let ITERATE_KEY = Symbol()

// 封装一个方法，接收一个参数isShallow，代表是否为浅响应，默认为false，即非浅响应
export function createReactive(obj, isShallow = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {

      // 代理对象可以通过 raw 属性访问原始数据，用于 set 操作时，判断 receiver 是否为target的代理对象
      if (key === 'raw') {
        return target
      }

      const res = Reflect.get(target, key, receiver)
      track(target, key)

      // 浅响应，直接返回原始值
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        return reactive(res)
      }

      return res
    },
    set(target, key, newVal, receiver) {
      // 拿到旧的值
      const oldVal = target[key]
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      const res = Reflect.set(target, key, newVal, receiver)


      // target === receiver 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        // 当新值和旧值不相同时，才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type)
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

    // 通过ownKeys 拦截函数，拦截 for...in循环
    ownKeys(target) {
      track(target, ITERATE_KEY)
      return Reflect.ownKeys(target)
    },

    // 删除属性的代理
    deleteProperty(target, key) {
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


