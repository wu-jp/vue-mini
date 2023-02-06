import { constructProxy } from "./proxy.js"

let uid = 0
export function initMixin(VueMini) {
  VueMini.prototype._init = function (options) {
    const vm = this
    vm.uid = uid++
    vm._isVueMini = true
    // 初始化data
    if (options && options.data) {
      vm._data = constructProxy(vm, options.data, '')
    }
    // 初始化created方法
    // 初始化methods方法
    // 初始化computed方法
    // 初始化el并挂载
  }
}
