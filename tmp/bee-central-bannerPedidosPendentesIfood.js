Vue.component('banner-pedidos-pendentes-ifood',{
    template: `
    <div id="ifoodBannerContainer" class="mb-5" style="justify-content: center;" v-if="countOrders > 0">
        <div class="d-md-flex d-none w-100 pb-2" style="border-bottom: 1px solid #DEDEDE">
            <div class="bg-card-ifood w-100">
                <div class="logo-container">
                    <img :src="logo" class="logo-img">
                    <div class="text-container">
                        <div class="text-label-small">
                            Integração ifood
                        </div>
                        <div class="text-label" id="pending-orders-count">
                            Há {{ countOrders }} pedidos pendentes
                        </div> 
                    </div>
                </div>
                <div>
                    <a href="/central/pedidos-ifood" class="d-block link">
                        <div class="button-basic">
                            <div class="text-label">
                                Ver pedidos
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    
        <div class="d-md-none d-flex pb-2" style="border-bottom: 1px solid #DEDEDE; width: fit-content;">
            <div class="bg-card-ifood">
                <div class="logo-container d-flex flex-col">
                    <div class="logo-text-container">
                        <img :src="logo" class="logo-img mr-1">
                        <div class="text-label-small">
                            Integração ifood
                        </div>
                    </div>
                    <div class="text-container">
                        <div class="text-label" id="pending-orders-count-mobile">
                            Há {{ countOrders }} pedidos pendentes
                        </div>
                    </div>
                </div>
                <div class="button-container">
                    <a href="/central/pedidos-ifood" class="d-block link">
                        <div class="button-basic">
                            <div class="text-label">
                                Ver pedidos
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    </div>
    `,
    props: {
        empresa_id: String,
        logo: String
    },
    data() {
        return {
            countOrders: 0
        }
    }, 
    methods: {
        carregarCountEntregas() {
            axios.get('/central/perfil/integrations/ifood/orders/list').then((response) => {
                this.countOrders = (Object.keys(response.data).length)
            })
        },
        inicializarEcho() {
            Echo.channel(`ifood-orders-${this.empresa_id}`)
            .listen('.ifoodCreatedOrder', () => {
                this.carregarCountEntregas()
            })
            .listen('.ifoodRemovedOrder', () => {
                this.carregarCountEntregas()
            })
        }
    },
    mounted() {
        this.carregarCountEntregas()
        this.inicializarEcho()
    }, 
    watch: {
        countOrders() {
            console.log(this.countOrders)
        }
    }
})