Vue.component('modal-central', {
    template: `
        <div class="modal fade" :id="id" role="dialog" data-keyboard="false" data-backdrop="static">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content modal-central">
                    
                    <div v-if="image" class="text-align-center mt-4">
                        <img :src="image">
                    </div>

                    <div v-if="header" class="modal-header p-4">
                        <h4 class="modal-title text-black text-lg">{{title}}</h4>
                        <button v-if="!disableCloseBtn" type="button" class="close" data-dismiss="modal" aria-label="Close"><i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                                    
                    <form :id="'form-'+id" :action="formAction" @submit="handleSubmit(event)" :method="formMethod">
                        <div class="modal-body p-4">
                            <slot></slot>
                        </div>
                        <div class="modal-footer d-flex flex-column">
                            <button type="submit" class="btn btn-warning font-weight-semi-bold py-2 m-0" :disabled="btnActive"><div class="my-1">{{btnlabel}}</div></button>
                            <button type="button" class="btn py-2 m-0" data-dismiss="modal"><div class="my-1">{{btnlabelSecondary}}</div></button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `,
    props: {
        id: String,
        formAction: {
            type: String,
            default: "#"
        },
        formMethod: {
            type: String,
            default: "POST"
        },
        title: String,
        btnlabel: String,
        btnlabelSecondary: {
            type: String,
            default: "Cancelar"
        },
        prevent: Boolean,
        eventId: String,
        btnActive: {
            type: Boolean,
            default: false
        },
        image: {
            type: String,
            default: null
        },
        header: {
            type: Boolean,
            default: true
        },
        disableCloseBtn: {
            type: Boolean,
            default: false
        }
    },
    methods: {
        handleSubmit(event) {
            $(`#${this.id}`).modal('hide')

            if (this.prevent) event.preventDefault()

            this.$emit('submit', this.eventId)
        }
    }
})
