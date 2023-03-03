function parse(str) {
  const tokens = tokenzise(str)

  const root = {
    type: 'Root',
    children: []
  }

  // 创建 elementStack 栈，起初只读 root 根节点
  const elementStack = [root]

  while (tokens.length) {

    // 获取当前栈点的顶层节点作为父节点
    const parent = elementStack[elementStack.length - 1]

    // 扫描token
    const t = tokens[0]

    switch (t.type) {
      case 'tag':
        // 如果 token 是开始标签，则创建 Element 类型的 AST 节点
        const elementNode = {
          type: 'Element',
          tag: t.name,
          children: []
        }
        parent.children.push(elementNode)
        break
      case 'text':
        // 如果 token 是文本，则创建 Text 类型的 AST 节点
        const textNode = {
          type: 'Text',
          content: t.content
        }
        // 将其添加到父节点的 children 中
        parent.children.push(textNode)
        break
      case 'tarEnd':
        // 遇到结束标签，将栈顶节点弹出
        elementStack.pop()
        break
    }

    // 消费已经扫描过的 token
    tokens.shift()

  }

  return root
}

// 用来将模板str 转变为 tokes
function tokenzise(str) {
  /* ... */
}


function dump(node, indent = 0) {
  const type = node.type
  const desc = node.type === 'Root' ? '' : node.type === 'Element' ? 'node.tag' : 'node.content'

  console.log(`${'-'.repeat(indent)}${type}: ${desc}`)

  if (node.children) {
    node.children.forEach(n => dump(n, indent + 2))
  }
}


function traverseNode(ast, context) {
  const currentNode = ast

  // context.nodeTransforms 是一个数组，其中每一项都是一个函数
  const transforms = context.nodeTransforms

  for (let i = 0; i < transforms.length; i++) {
    // 将当前节点 currentNode 和 context 都传递给 nodeTransforms 中注册的回调函数
    transforms[i](currentNode, context)
  }

  const children = currentNode.children
  if (children) {
    for (let i = 0; i < children.length; i++) {
      traverseNode(children[i])
    }
  }
}

function transform(ast) {
  const context = {
    nodeTransforms: [
      transformElement, // 用来转换标签节点
      transformText,  // 用来转换文本节点
    ]
  }
  traverseNode(ast, context)
  console.log(dump(ast))
}

function transformElement(node) {
  if (node.type === 'Element' && node.tag === 'p') {
    node.tag = 'h1'
  }
}

function transformText() {
  if (node.type === 'Text') {
    node.content = node.content.repeat(2)
  }
}

const ast = parse(`<div><p>Vue</p><p>Template</p></div>`)
transform(ast)
