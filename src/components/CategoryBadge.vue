<script setup>
import { computed } from 'vue'
import { categories } from '../lib/points.js'

const props = defineProps({
  category: { type: String, required: true },
  showIcon: { type: Boolean, default: false }, 
})

const icon = computed(() => categories.find((c) => c.name === props.category)?.icon ?? '/images/icons/others.png')
</script>


<template>
  <span class="category-label">
    <span v-if="showIcon" class="category-icon" >
       <img :src="icon" class="category-icon-img" alt="" />
      </span>
        {{ category }}
      </span>
</template>
