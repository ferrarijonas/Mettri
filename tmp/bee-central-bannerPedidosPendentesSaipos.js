Vue.component('banner-pedidos-pendentes-saipos',{
    template: `
    <div id="saiposBannerContainer" class="mb-5" style="justify-content: center;" v-if="countOrders > 0">
        <div class="d-md-flex d-none w-100 pb-2" style="border-bottom: 1px solid #DEDEDE">
            <div class="bg-card-ifood w-100">
                <div class="logo-container">
                    <img :src="logo" class="logo-img" alt="Logo da empresa de delivery saipos">
                    <div class="text-container">
                        <div class="text-label-small">
                            Integração Saipos
                        </div>
                        <div class="text-label" id="pending-orders-count">
                            Há {{ countOrders }} pedidos pendentes
                        </div> 
                    </div>
                </div>
                <div>
                    <a :href="'/central/pedidos-saipos/' + empresa_id" class="d-block link">
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
                        <img :src="logo" class="logo-img mr-1" alt="Logo da empresa de delivery saipos">
                        <div class="text-label-small">
                            Integração Saipos
                        </div>
                    </div>
                    <div class="text-container">
                        <div class="text-label" id="pending-orders-count-mobile">
                            Há {{ countOrders }} pedidos pendentes
                        </div>
                    </div>
                </div>
                <div class="button-container">
                    <a href="/central/pedidos-saipos/{{ empresa_id }}" class="d-block link">
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
            axios.get('/api/saipos/orders/getOrders/'+this.empresa_id).then((response) => {
                console.log('Response completa:', response.data);
                console.log('Orders:', response.data.orders);
                
                // check if orders is an object and convert to array if necessary
                const orders = response.data.orders;
                const ordersArray = Array.isArray(orders) ? orders : Object.values(orders);
                
                this.countOrders = ordersArray.length;
                console.log('Número de pedidos:', this.countOrders);
            }).catch(error => {
                console.error('Erro ao carregar pedidos:', error);
            });
        },
        inicializarEcho() {
            const eventos = ['.saiposCreatedOrder', '.saiposRemovedOrder'];

            let canal = Echo.channel(`saipos-orders-${this.empresa_id}`);

            eventos.forEach(evento => canal.listen(evento, this.carregarCountEntregas));
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