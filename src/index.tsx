/* @refresh reload */
import { Component } from 'solid-js'
import { render } from 'solid-js/web'
import './index.css'

export const Main: Component = () => {
    return <p>Hello</p>
}

render(() => <Main />, document.getElementById('root')!)
