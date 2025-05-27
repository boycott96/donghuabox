<template>
  <svg aria-hidden="true" class="svg-icon">
    <use :xlink:href="`#${prefix}-${name}`" />
  </svg>
</template>
<script setup>
defineProps({
  prefix: {
    type: String,
    default: 'icon'
  },
  name: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.svg-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
  overflow: hidden;
}
</style>
