Vue.component('auto-complete-google', {
    template: `
        <div class="form-group text-left text-sm-right">
            <input :name="name" :id="id" :value="value" type="hidden">
            <div class="inputcontainer">
                <input autocomplete="off" class="form-control" :id="id_autocomplete" v-model="term" :placeholder="placeholder" @blur="focusOut" @focus="focusIn" @input="handleInput"> 
                <div class="icon-container" v-show="isLoading && term.length > 0">
                    <i class="loader"></i>
                </div>
                <div class="icon-container" v-show="focusWithOutNumber">
                    <i class="fal fa-exclamation-triangle withoutNumber"></i> <span class="withoutNumber--label"> Digite o número</span>
                </div>
            </div>          

            <div class="list-group without-number" v-if="endWithOutNumber">
                <span class="checkEndWithOutNumber">
                    <input class="form-check-input-end" type="checkbox"  @change="checkedWithOuNumber" v-model="checked" id="flexCheckChecked">
                    Endereço sem número
                </span>
                
            </div>

            <div v-if="term && message" class="list-group text-center"> 
                <span class="list-group-item btn-address__info--label">{{ message }}</span>
            </div>

            <div class="list-group">
            <div class="address-search-step__results">
            <ul class="address-search-list">
                <li v-for="item in items" @click="selectItem(item)">
                    <div class="btn-address btn-address--simple btn-address__container">
                        <div class="btn-address__icon--left">
                            <div class="btn-address__icon-actions"></div>
                            <span class="icon-marmita"> <i class="far fa-map-marker-alt"></i></span>
                        </div>
                        <div class="btn-address__info"><span class="btn-address__info--label"> {{ item.structured_formatting.main_text }} </span>
                        <span class="btn-address__info--description"> {{ item.structured_formatting.secondary_text }} </span></div>
                    </div>
                </li>
            </ul>
        </div>
               
            </div>
        </div>    
    `,
    props: {
        name: String,
        id: String,
        placeholder: String,
        route: String,
        autoroute: String,
        defaultvalue: String,
        method: { type: Function },
    },

    data() {
        return {
            timeout: null,
            term: this.value,
            termCheck: null,
            items: null,
            circle: null,
            address: null,
            value: null,
            isLoading: false,
            checked: false,
            endSave: null,
            focusWithOutNumber: false,
            endWithOutNumber: false,
            id_autocomplete: this.id + '_autocomplete'
        }
    },
    computed: {       
        message() {
            if (this.term.length < 6){
                this.isLoading = false;
                return 'Digite pelo menos 6 caracteres...'
            } 
            else if (this.items?.length === 0) {
                this.isLoading = false;
                return 'Nenhum resultado encontrado'
            }
        },
    },
    methods: {
        checkedWithOuNumber() {
            if (this.checked) {
                this.selectItem(this.endSave, true)
                this.focusOut()
            } else {
                this.term = this.termCheck;
                var element =   document.getElementById(this.id_autocomplete);
                this.method(null, this.id);
                element.value = this.termCheck;
                element.focus();
                element.selectionStart = this.term.length - 6;
                element.selectionEnd = this.term.length;
                this.items = null
            }
        },
        focusOut() {
            var element = document.getElementById(this.id_autocomplete);
            if(this.termCheck && !this.checked){
                element.classList.add("error-number");
                this.focusWithOutNumber = true;
            }else{
                element.classList.remove("error-number");
                this.focusWithOutNumber = false;
            }
        },
        focusIn() {
            var element = document.getElementById(this.id_autocomplete);
            element.classList.remove("error-number");
            this.focusWithOutNumber = false;
            if(this.termCheck && !this.checked){
                element.selectionStart = this.term.length - 6;
                element.selectionEnd = this.term.length;
            }
        }, 
        handleInput({ target }) {
            this.isLoading = true;
            clearTimeout(this.timeout)
            this.endWithOutNumber = false;
            this.checked = false;
            this.termCheck = null;
            this.method(null, this.id);
            this.timeout = setTimeout(() => {
                this.term = target.value
                this.items = null
                if (this.term.length < 6) return                
                this.queryItems()
            }, 750)
        },

        async queryItems() {
            this.method(null, this.id);
            const params = { input: this.term }
            await axios.get(this.autoroute, { params })
                .catch(console.error)
                .then((response) => {
                    this.items = response.data.predictions;
                    this.isLoading = false;
                })
        },

        selectItem(item, check = false) {
            if (item.structured_formatting.main_text.split(',').length < 2 && !item.types.includes("establishment") && !check) {
                this.endWithOutNumber = true;
                this.endSave = item;
                var element = document.getElementById(this.id_autocomplete);
                element.value = item.structured_formatting.main_text.trim() + ', número';                
                this.term = this.termCheck = item.structured_formatting.main_text.trim() + ', número';                
                element.focus();
                element.selectionStart = this.term.length - 6;
                element.selectionEnd = this.term.length;
                this.items = null
                return
            }
            this.getItem(item);
        },

        async getItem(item) {
            const params = { place: item.place_id, address: item.description}
            await axios.get(this.route, { params })
                .catch(console.error)
                .then((response) => {
                    this.address = this.value = response.data.data.address;
                    this.method(response.data.data, this.id);
                })
            this.focusIn()
            this.term = item.description
            this.items = null
        },
    },
    watch: {
        defaultvalue(){
            this.term = this.value = this.defaultvalue;
        }
    },
    mounted() {
        this.term = this.value = this.defaultvalue;
    }
})
