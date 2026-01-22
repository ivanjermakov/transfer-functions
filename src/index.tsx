/* @refresh reload */
import { render } from 'solid-js/web'
import './index.css'
import { Component } from 'solid-js'

export const Main: Component = () => {
    return <p>Hello</p>
}

render(() => <Main/>, document.getElementById('root')!)
