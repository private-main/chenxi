<template>
  <div class="page">
    <van-nav-bar title="商品管理" fixed placeholder>
      <template #right>
        <van-button @click="openCreate">新增</van-button>
      </template>
    </van-nav-bar>

    <div class="content">
      <div class="search">
        <van-field
          v-model.trim="keyword"
          placeholder="按名称检索（部分匹配）"
          clearable
          left-icon="search"
        />
        <van-radio-group v-model="soldFilter" direction="horizontal" class="filter-radio">
          <van-radio name="all">全部</van-radio>
          <van-radio name="unsold">未售</van-radio>
          <van-radio name="sold">已售</van-radio>
        </van-radio-group>
        <div class="date-filter">
          <span class="date-filter__label">收购日区间</span>
          <van-field v-model="purchaseDateStart" type="date" placeholder="开始日期" class="date-field" />
          <span class="date-filter__sep">至</span>
          <van-field v-model="purchaseDateEnd" type="date" placeholder="结束日期" class="date-field" />
          <van-button v-if="purchaseDateStart || purchaseDateEnd" size="small" @click="clearDateFilter">清除</van-button>
        </div>
        <div class="sort-bar">
          <span class="sort-label">排序</span>
          <van-dropdown-menu>
            <van-dropdown-item v-model="sortField" :options="sortFieldOptions" />
          </van-dropdown-menu>
          <van-button size="small" @click="toggleSortOrder">
            {{ sortOrder === 'asc' ? '↑ 升序' : '↓ 降序' }}
          </van-button>
        </div>
        <div class="summary" v-if="goods.length > 0">
          <span>命中 {{ filteredGoodsList.length }} 条</span>
          <span class="summary__sep">·</span>
          <span>总利润 ¥{{ filteredTotal.toFixed(2) }}</span>
        </div>
      </div>

      <van-empty v-if="filteredGoodsList.length === 0" :description="emptyText" />

      <div v-else class="goods-list">
        <div v-for="g in filteredGoodsList" :key="g.id" class="goods-card" @click="openEdit(g)">
          <div class="goods-card__header">
            <div class="goods-card__name">{{ g.name }}</div>
            <van-tag :type="g.soldDate ? 'success' : 'warning'" plain>{{ g.soldDate ? '已售' : '未售' }}</van-tag>
          </div>
          <div class="goods-card__info">
            <div class="goods-card__row">
              <span class="label">收购价</span>
              <span class="value price-text">¥{{ g.purchasePrice.toFixed(2) }}</span>
            </div>
            <div class="goods-card__row" v-if="g.soldDate">
              <span class="label">售出价</span>
              <span class="value price-text">¥{{ g.soldPrice.toFixed(2) }}</span>
            </div>
            <div class="goods-card__row" v-if="g.soldDate">
              <span class="label">利润</span>
              <span class="value price-text">¥{{ (g.soldPrice - g.purchasePrice).toFixed(2) }}</span>
            </div>
          </div>
          <div class="goods-card__footer">
            <div class="goods-card__date">
              <span>收购日: {{ g.purchaseDate || '-' }}</span>
              <span v-if="g.soldDate">售出日: {{ g.soldDate }}</span>
            </div>
            <van-button size="small" type="danger" @click.stop="confirmDelete(g)">删除</van-button>
          </div>
        </div>
      </div>
    </div>

    <van-popup v-model:show="editorVisible" position="bottom" round class="editor-popup">
      <div class="editor">
        <div class="editor__header">
          <div class="editor__title">{{ editorMode === 'create' ? '新增商品' : '编辑商品' }}</div>
          <van-button size="small" type="default" @click="closeEditor">关闭</van-button>
        </div>

        <van-form @submit="onSubmit">
          <van-field
            v-model.trim="draft.name"
            name="name"
            label="名称"
            placeholder="例如：可乐 330ml"
            :rules="[{ required: true, message: '请输入商品名称' }]"
          />

          <van-field
            v-model="draft.purchaseDate"
            name="purchaseDate"
            label="收购日"
            type="date"
            placeholder="请选择收购日期"
            :rules="[{ required: true, message: '请选择收购日' }]"
          />
          <van-field name="purchasePrice" label="收购价格(¥)">
            <template #input>
              <input
                v-model="draft.purchasePriceText"
                class="van-field__control"
                inputmode="decimal"
                placeholder="例如：2.8"
              />
            </template>
          </van-field>

          <van-field v-model="draft.soldDate" name="soldDate" label="售出日" type="date" placeholder="未售出可不填" />
          <van-field name="soldPrice" label="售出价格(¥)">
            <template #input>
              <input
                v-model="draft.soldPriceText"
                class="van-field__control"
                inputmode="decimal"
                placeholder="未售出可不填"
              />
            </template>
          </van-field>

          <van-field
            v-if="editorMode === 'edit'"
            v-model="draft.remark"
            name="remark"
            label="备注"
            type="textarea"
            placeholder="请输入备注"
            rows="2"
          />

          <div class="editor__footer">
            <van-button block type="primary" native-type="submit">
              {{ editorMode === 'create' ? '保存' : '保存修改' }}
            </van-button>
          </div>
        </van-form>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { showToast, showConfirmDialog } from 'vant'

type Goods = {
  id: string
  name: string
  purchaseDate: string
  soldDate: string
  purchasePrice: number
  soldPrice: number
  remark: string
  updatedAt: number
}

const STORAGE_KEY = 'goods-admin:goods:v1'

function loadGoods(): Goods[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => x as Partial<Goods>)
      .filter((x) => typeof x.id === 'string' && typeof x.name === 'string')
      .map((x) => ({
        id: x.id!,
        name: x.name!,
        purchaseDate: typeof x.purchaseDate === 'string' ? x.purchaseDate : '',
        soldDate: typeof x.soldDate === 'string' ? x.soldDate : '',
        purchasePrice: typeof x.purchasePrice === 'number' ? x.purchasePrice : 0,
        soldPrice: typeof x.soldPrice === 'number' ? x.soldPrice : 0,
        remark: typeof x.remark === 'string' ? x.remark : '',
        updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : Date.now(),
      }))
  } catch {
    return []
  }
}

function saveGoods(list: Goods[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const goods = ref<Goods[]>(loadGoods())

watchEffect(() => {
  saveGoods(goods.value)
})

const goodsList = computed(() =>
  [...goods.value].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
)

const keyword = ref('')
const soldFilter = ref<'all' | 'sold' | 'unsold'>('all')
const purchaseDateStart = ref('')
const purchaseDateEnd = ref('')
const sortField = ref<'purchaseDate' | 'soldDate' | 'purchasePrice' | 'soldPrice' | 'profit' | 'name'>('purchaseDate')
const sortOrder = ref<'asc' | 'desc'>('desc')

const sortFieldOptions = [
  { text: '收购日', value: 'purchaseDate' },
  { text: '售出日', value: 'soldDate' },
  { text: '收购价', value: 'purchasePrice' },
  { text: '售出价', value: 'soldPrice' },
  { text: '利润', value: 'profit' },
  { text: '名称', value: 'name' },
]

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function clearDateFilter() {
  purchaseDateStart.value = ''
  purchaseDateEnd.value = ''
}

const filteredGoodsList = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  let list = goodsList.value
  if (k) {
    list = list.filter((g) => g.name.toLowerCase().includes(k))
  }

  if (purchaseDateStart.value) {
    list = list.filter((g) => g.purchaseDate >= purchaseDateStart.value)
  }
  if (purchaseDateEnd.value) {
    list = list.filter((g) => g.purchaseDate <= purchaseDateEnd.value)
  }

  if (soldFilter.value === 'sold') {
    list = list.filter((g) => g.soldDate)
  } else if (soldFilter.value === 'unsold') {
    list = list.filter((g) => !g.soldDate)
  }

  list = [...list].sort((a, b) => {
    let aVal: number | string = 0
    let bVal: number | string = 0

    switch (sortField.value) {
      case 'purchaseDate':
        aVal = a.purchaseDate || ''
        bVal = b.purchaseDate || ''
        break
      case 'soldDate':
        aVal = a.soldDate || ''
        bVal = b.soldDate || ''
        break
      case 'purchasePrice':
        aVal = a.purchasePrice
        bVal = b.purchasePrice
        break
      case 'soldPrice':
        aVal = a.soldPrice
        bVal = b.soldPrice
        break
      case 'profit':
        aVal = a.soldPrice - a.purchasePrice
        bVal = b.soldPrice - b.purchasePrice
        break
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
    }

    if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })

  return list
})

const filteredTotal = computed(() =>
  filteredGoodsList.value.reduce((sum, g) => sum + (g.soldPrice - g.purchasePrice), 0),
)

const emptyText = computed(() => {
  if (goods.value.length === 0) return '暂无商品，点击右上角新增'
  if (filteredGoodsList.value.length === 0) return '未找到匹配商品'
  return ''
})

const editorVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)

const draft = reactive({
  name: '',
  purchaseDate: '',
  soldDate: '',
  purchasePriceText: '',
  soldPriceText: '',
  remark: '',
})

function resetDraft() {
  draft.name = ''
  draft.purchaseDate = ''
  draft.soldDate = ''
  draft.purchasePriceText = ''
  draft.soldPriceText = ''
  draft.remark = ''
}

function openCreate() {
  editorMode.value = 'create'
  editingId.value = null
  resetDraft()
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  draft.purchaseDate = `${yyyy}-${mm}-${dd}`
  editorVisible.value = true
}

function openEdit(g: Goods) {
  editorMode.value = 'edit'
  editingId.value = g.id
  draft.name = g.name
  draft.purchaseDate = g.purchaseDate
  draft.soldDate = g.soldDate
  draft.purchasePriceText = String(g.purchasePrice)
  draft.soldPriceText = String(g.soldPrice)
  draft.remark = g.remark || ''
  editorVisible.value = true
}

function closeEditor() {
  editorVisible.value = false
}

function parsePrice(priceText: string) {
  const n = Number(priceText)
  if (!Number.isFinite(n)) return null
  if (n < 0) return null
  return Math.round(n * 100) / 100
}

function parsePriceOptional(priceText: string) {
  const t = priceText.trim()
  if (!t) return null
  return parsePrice(t)
}

async function confirmDelete(g: Goods) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: `确定删除「${g.name}」吗？此操作无法恢复。`,
    })
  } catch {
    return
  }
  goods.value = goods.value.filter((x) => x.id !== g.id)
  showToast({ message: '已删除', type: 'success' })
}

function onSubmit() {
  if (!draft.name.trim()) {
    showToast({ message: '请输入商品名称', type: 'fail' })
    return
  }

  if (!draft.purchaseDate) {
    showToast({ message: '请选择收购日', type: 'fail' })
    return
  }

  const purchasePrice = parsePriceOptional(draft.purchasePriceText)
  if (purchasePrice === null) {
    showToast({ message: '请输入收购价格', type: 'fail' })
    return
  }

  const soldPrice = parsePriceOptional(draft.soldPriceText)
  if (draft.soldDate && soldPrice === null) {
    showToast({ message: '已选择售出日，请输入售出价格', type: 'fail' })
    return
  }
  if (!draft.soldDate && soldPrice !== null) {
    showToast({ message: '已输入售出价格，请选择售出日', type: 'fail' })
    return
  }

  const now = Date.now()

  if (editorMode.value === 'create') {
    const item: Goods = {
      id: uid(),
      name: draft.name,
      purchaseDate: draft.purchaseDate,
      soldDate: draft.soldDate,
      purchasePrice,
      soldPrice: soldPrice ?? 0,
      remark: draft.remark,
      updatedAt: now,
    }
    goods.value = [item, ...goods.value]
    showToast({ message: '已新增', type: 'success' })
    editorVisible.value = false
    return
  }

  const id = editingId.value
  if (!id) return

  goods.value = goods.value.map((x) =>
    x.id === id
      ? {
          ...x,
          name: draft.name,
          purchaseDate: draft.purchaseDate,
          soldDate: draft.soldDate,
          purchasePrice,
          soldPrice: soldPrice ?? 0,
          remark: draft.remark,
          updatedAt: now,
        }
      : x,
  )
  showToast({ message: '已保存', type: 'success' })
  editorVisible.value = false
}
</script>

<style scoped>
/* Glassmorphism 基础变量 */
.glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.page {
  min-height: 100vh;
}

/* 导航栏玻璃态 */
.page :deep(.van-nav-bar) {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
}

.page :deep(.van-nav-bar__title) {
  color: #fff;
  font-weight: 600;
  font-size: 18px;
}

.page :deep(.van-nav-bar__text) {
  color: #fff;
}

.page :deep(.van-hairline--bottom::after) {
  display: none;
}

/* 新增按钮玻璃态 */
.page :deep(.van-nav-bar__right) {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  margin-right: 8px;
}

.page :deep(.van-nav-bar__right .van-button) {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
}

.page :deep(.van-nav-bar__right .van-button:active) {
  opacity: 0.8;
}

/* 编辑弹窗玻璃态 */
.editor-popup {
  background: linear-gradient(180deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.5) 100%);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 20px 20px 0 0;
  overflow: hidden;
}

.content {
  padding: 16px;
}

.search {
  padding: 0 0 8px;
}

/* 搜索框玻璃态 */
.search :deep(.van-field) {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  margin-bottom: 8px;
}

.search :deep(.van-field__control) {
  color: #fff;
}

.search :deep(.van-field__control::placeholder) {
  color: rgba(255, 255, 255, 0.7);
}

.search :deep(.van-field__left-icon .van-icon) {
  color: rgba(255, 255, 255, 0.8);
}

.filter-radio {
  padding: 8px 0;
}

/* 单选按钮玻璃态 */
.filter-radio :deep(.van-radio) {
  margin-right: 16px;
}

.filter-radio :deep(.van-radio__label) {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.filter-radio :deep(.van-radio__icon--checked .van-icon) {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.6);
}

.filter-radio :deep(.van-icon) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  flex-wrap: wrap;
}

.date-filter__label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.date-filter__sep {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* 日期选择框玻璃态 */
.date-field {
  flex: 1;
  min-width: 100px;
  padding: 0;
}

.date-field :deep(.van-field__body) {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  padding: 4px 8px;
  min-height: 28px;
}

.date-field :deep(.van-field__control) {
  color: #fff;
  font-size: 12px;
}

.date-field :deep(.van-field__control::placeholder) {
  color: rgba(255, 255, 255, 0.6);
}

.sort-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.sort-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* 排序栏玻璃态 */
.sort-bar :deep(.van-dropdown-menu) {
  background: transparent;
  box-shadow: none;
}

.sort-bar :deep(.van-dropdown-menu__bar) {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  height: 32px;
  box-shadow: none;
}

.sort-bar :deep(.van-dropdown-menu__title) {
  color: #fff;
  font-size: 13px;
}

.sort-bar :deep(.van-dropdown-menu__title:after) {
  display: none;
}

.sort-bar :deep(.van-dropdown-menu__bar:active) {
  background: rgba(255, 255, 255, 0.4);
}

.sort-bar :deep(.van-popup--top) {
  background: rgba(118, 75, 162, 0.95) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
}

.sort-bar :deep(.van-dropdown-item) {
  background: transparent !important;
}

.sort-bar :deep(.van-dropdown-item__content) {
  background: transparent !important;
  padding: 8px;
}

.sort-bar :deep(.van-dropdown-item__option) {
  color: #fff !important;
  font-size: 14px;
  text-align: center;
  padding: 10px 16px;
  border-radius: 8px;
  background: transparent !important;
}

.sort-bar :deep(.van-dropdown-item__option--active) {
  background: rgba(255, 255, 255, 0.35) !important;
  color: #fff !important;
}

.sort-bar :deep(.van-dropdown-item__option:active) {
  background: rgba(255, 255, 255, 0.4);
}

.sort-bar :deep(.van-ellipsis) {
  color: inherit;
}

/* 下拉遮罩层玻璃态 */
.sort-bar :deep(.van-overlay) {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

/* 排序按钮玻璃态 */
.sort-bar :deep(.van-button) {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  font-size: 12px;
  border-radius: 8px;
  height: 32px;
}

.sort-bar :deep(.van-button:active) {
  background: rgba(255, 255, 255, 0.4);
}

.summary {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.95);
  font-weight: 500;
  margin-bottom: 10px;
}

.summary__sep {
  opacity: 0.6;
}

.goods-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 商品卡片玻璃态 */
.goods-card {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  padding: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.goods-card:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.goods-card:active {
  transform: translateY(0);
  background: rgba(255, 255, 255, 0.3);
}

.goods-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.goods-card__name {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 标签玻璃态 */
.goods-card__header :deep(.van-tag) {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 12px;
}

.goods-card__header :deep(.van-tag--success) {
  background: rgba(34, 197, 94, 0.4);
  border-color: rgba(34, 197, 94, 0.5);
}

.goods-card__header :deep(.van-tag--warning) {
  background: rgba(255, 186, 0, 0.4);
  border-color: rgba(255, 186, 0, 0.5);
}

.goods-card__info {
  display: flex;
  gap: 32px;
  margin-bottom: 14px;
}

.goods-card__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.goods-card__row .label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.goods-card__row .value {
  font-size: 15px;
  color: #fff;
  font-weight: 500;
}

.goods-card__row .price-text {
  font-weight: 700;
  color: #ffd700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  min-width: 90px;
}

.goods-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.goods-card__date {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

/* 删除按钮玻璃态 */
.goods-card__footer :deep(.van-button) {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 13px;
}

.goods-card__footer :deep(.van-button--danger) {
  background: rgba(255, 82, 82, 0.4);
  border-color: rgba(255, 82, 82, 0.5);
}

.goods-card__footer :deep(.van-button:active) {
  background: rgba(255, 82, 82, 0.5);
}

/* 编辑弹窗内部 */
.editor {
  padding: 16px;
}

.editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 16px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.editor__title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.editor__header :deep(.van-button) {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.editor__footer {
  padding: 16px 0 0;
}

.editor__footer :deep(.van-button) {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  font-weight: 600;
  border-radius: 12px;
  height: 46px;
  font-size: 16px;
}

.editor__footer :deep(.van-button:active) {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.3));
}

/* 表单玻璃态 */
.editor :deep(.van-cell-group) {
  background: transparent;
}

.editor :deep(.van-cell) {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  margin-bottom: 10px;
  padding: 10px 14px;
}

.editor :deep(.van-cell__title) {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
}

.editor :deep(.van-field__control) {
  color: #fff;
  font-size: 14px;
}

.editor :deep(.van-field__control::placeholder) {
  color: rgba(255, 255, 255, 0.5);
}

.editor :deep(.van-field__body) {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 6px 10px;
}

.editor :deep(.van-field__error-message) {
  color: #ff9999;
}

/* 导航栏玻璃态 */
.content :deep(.van-nav-bar) {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.content :deep(.van-nav-bar__title) {
  color: #fff;
  font-weight: 600;
}

.content :deep(.van-nav-bar__text) {
  color: #fff;
}

.content :deep(.van-hairline--bottom::after) {
  display: none;
}

/* 新增按钮玻璃态 */
.content :deep(.van-nav-bar__right) {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 8px;
  padding: 4px 12px;
  height: auto;
}

.content :deep(.van-nav-bar__right .van-button) {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 13px;
}

/* 空状态玻璃态 */
.content :deep(.van-empty) {
  padding: 60px 0;
}

.content :deep(.van-empty__description) {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

/* 对话框玻璃态 */
.content :deep(.van-dialog) {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
}

.content :deep(.van-dialog__header) {
  color: #fff;
  padding-top: 24px;
}

.content :deep(.van-dialog__message) {
  color: rgba(255, 255, 255, 0.85);
}

.content :deep(.van-dialog__confirm) {
  color: #fff;
}

.content :deep(.van-dialog__cancel) {
  color: rgba(255, 255, 255, 0.8);
}

/* Toast 玻璃态 */
.content :deep(.van-toast) {
  background: rgba(50, 50, 50, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 12px;
}
</style>

