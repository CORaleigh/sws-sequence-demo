import './style.css'
import { setupMap } from './map.js'

document.querySelector('#app').innerHTML = `
    <div id="viewDiv"></div>
`

setupMap(document.querySelector('#viewDiv'))
