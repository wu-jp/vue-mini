import { effect, trigger, track } from "./effect.js";

export function computed(getter) {
  // 用来缓存上次的计算值
  let value;
  // dirty 标志，用来标识是否需要重新计算值，true 则意味着“脏”，需要计算
  let dirty = true
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 修改为 true
    scheduler() {
      if (!dirty) {
        dirty = true
        // 当计算属性依赖的响应式数据发生变化时，手动调用 trigger 函数触发响应
        trigger(obj, 'value')
      }
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      // 当读取 value 时，手动调用 track 函数进行追踪
      track(obj, 'value')
      return value
    }
  }

  return obj
}
