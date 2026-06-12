Vue.component('card-aviso', {
    template: `
        <main :id="id" class="px-0 px-lg-3 aviso d-flex justify-content-between flex-column flex-sm-row" :class="{ 'aviso-azul': level == '1', 'aviso-amarelo': level == '2', 'aviso-vermelho': level == '3', 'aviso-verde': level == '4' }">
            <aside class="aviso-body">
                <header @click="mobileLinkClick">
                    <h3 class="font-weight-bold text-lg-xl text-sm">{{formatTitle}}</h3>
                </header>
                <main class="d-none d-sm-block text-xs text-lg-sm">
                    <p>
                        {{ fitMessage }}
                    </p>
                    <a :id="'link-aviso-'+id" v-if="link" :href="link" :target="target">Leia mais</a>
                    <a :id="'link-aviso-'+id" v-if="!link" data-toggle="modal" :data-target="'#modalAviso-'+id">Leia mais</a>
                </main>
            </aside> 
            <img :src="image" alt="Alerta" @click="mobileLinkClick">

            <div class="modal fade" :id="'modalAviso-'+id" role="dialog" aria-labelledby="myModalLabel" data-keyboard="false" data-backdrop="static">
                <div class="info-modal modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header py-4 px-4">
                            <h6 class="modal-title font-weight-bold">{{ title || 'Aviso' }}</h6>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <i class="fas fa-times-circle text-muted"></i>
                            </button>
                        </div>
                        <div class="modal-body p-4 font-weight-light">
                            <p class="text-sm text-muted">
                                {{message}}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    `,
    props: {
        id: String,
        level: Number,
        title: String,
        message: String,
        link: String,
        image: String,
        target: String
    },
    computed: {
        fitMessage() {
            if (!this.message) return ''
            const length = Math.floor(screen.width / 9)
            if (this.message.length < length) return this.message
            return this.message.slice(0, length - 4) + ' ...'
        },
        formatTitle() {
            if (this.title) return this.title
            if (!this.message) return 'Aviso'
            const length = Math.floor(screen.width / 27)
            if (this.message.length < length) return this.message
            return this.message.slice(0, length - 4) + ' ...'
        },
    },
    methods: {
        mobileLinkClick() {
            if (screen.width < 576) this.handleLinkClick()
        },
        handleLinkClick() {
            document.querySelector(`#link-aviso-${this.id}`).click()
        }
    },
    mounted: function(){
        if (location.hash == `#${this.id}`) this.handleLinkClick()
    }
})
