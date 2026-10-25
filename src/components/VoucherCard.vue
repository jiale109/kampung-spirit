<script setup>
defineProps({
    voucher: { type: Object, required: true },
    canAfford: { type: Boolean, default: true },
})

defineEmits(['select'])
</script>

<template>
    <div class="card h-100 shadow-sm border rounded-4 voucher-card" role="button" tabindex="0"
        @click="$emit('select', voucher)" @keydown.enter="$emit('select', voucher)"
        @keydown.space.prevent="$emit('select', voucher)">
        <!-- Logo Container -->
        <div class="rounded-top-4 d-flex align-items-center justify-content-center p-3 overflow-hidden"
            :style="{ backgroundColor: voucher.bg, height: '135px' }">
            <img :src="voucher.logo" :alt="voucher.merchant" class="img-fluid"
                style="max-height: 100px; object-fit: contain;" loading="lazy"
                @error="$event.target.style.display = 'none'" />
        </div>

        <!-- Card Body -->
        <div class="card-body d-flex flex-column justify-content-between p-3">
            <div>
                <h5 class="card-title fw-bold fs-5 mb-1 text-truncate text-dark">
                    {{ voucher.merchant }}
                </h5>
                <p class="card-text text-muted small text-truncate mb-3">
                    {{ voucher.title }}
                </p>
            </div>

            <div class="d-flex align-items-center justify-content-between pt-2 border-top">
                <span class="points-pill text-nowrap">
                     <img src="/images/coin.svg" class="point-coin-img" alt="" /> {{ voucher.cost }} pts
                </span>

                <span v-if="!canAfford"
                    class="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill text-nowrap px-2 py-1">
                    Need pts
                </span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.voucher-card {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.voucher-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.12) !important;
}
</style>