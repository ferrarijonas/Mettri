Vue.component('card-sem-resultados', {
    template: `
        <div class="sem-resultados w-100 d-flex flex-column flex-sm-row align-items-center justify-content-center" :class="{'bordered-yellow-large': bordered}">
            <div class="ml-sm-auto mr-sm-5 mt-3">
                <img :src="image"/>
            </div>
            <div class="mr-sm-auto ml-sm-5">
                <h2>{{ title }}</h2>
                <h6 class="font-weight-normal my-4">{{ message }}.</h6>
                <button class="btn action-btn py-2 px-4 mt-2" @click="$emit('action')">
                    {{btnlabel}}
                </button>
            </div>
        </div>
    `,
    props: {
        image: String,
        title: String,
        message: String,
        btnlabel: String,
        bordered: Boolean
    }
})
