Vue.component('card-info-beneficios', {
    template: `
        <div class="card-info">
            <div class="card-group">
                <div class="card-info-img">
                    <i :class="card.icon"></i>
                </div>
                <div class="card-info-message" v-html="card.message"></div>
            </div>
            <div @click="closeCard()" class="icon-close"><i class="far fa-times"></i></div>
        </div>
    `,
    props: {
        myevent: Function,
        empresaId: String
    },
    data() {
        return {
            infos: [
                { id: 1, message: 'Seus produtos estão <b>protegidos</b> com a nossa <b>Proteção de Cargas!</b>', icon: "fas fa-solid fa-shield-check fa-lg mr-2" },
                { id: 2, message: 'Conte com o nosso <b>suporte humanizado</b> e <b>comerciais a disposição</b> para ajudá-lo em qualquer situação!', icon: "fas fa-solid fa-comment-smile fa-lg mr-2" },
                { id: 3, message: 'Frota de <b>entregadores verificados</b> disponíveis para realizar suas entregas!', icon: "fas fa-solid fa-user-check fa-lg mr-2" }
            ],
            cardCurrent: 0,
            intervalId: null
        }
    },
    computed: {
        card() { 
            return this.infos[this.cardCurrent]
        }
    },
    methods: {
        changeCard() {
            if (this.cardCurrent < 2) {
                this.cardCurrent += 1;
            } else {
                this.cardCurrent = 0;
            }
        },
        contador() {
            thiss = this
            this.intervalId = setInterval(() => { thiss.changeCard() }, 10000)
        },
        closeCard() { 
            this.$emit('infoevent');
            sessionStorage.setItem('EMPINFO' + this.empresaId, false);
            clearInterval(this.intervalId);
        }
    },
    mounted() {
        this.contador();
    },
})