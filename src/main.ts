import { createApp } from 'vue'
import {
  Button,
  Cell,
  CellGroup,
  DropdownMenu,
  DropdownItem,
  Empty,
  Field,
  Form,
  NavBar,
  Popup,
  Radio,
  RadioGroup,
  Space,
  Stepper,
  Tag,
} from 'vant'
import 'vant/lib/index.css'
import './style.css'
import App from './App.vue'

const app = createApp(App)

;[
  Button,
  Cell,
  CellGroup,
  DropdownMenu,
  DropdownItem,
  Empty,
  Field,
  Form,
  NavBar,
  Popup,
  Radio,
  RadioGroup,
  Space,
  Stepper,
  Tag,
].forEach((c) => app.use(c))

app.mount('#app')
