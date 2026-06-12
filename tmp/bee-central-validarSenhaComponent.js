Vue.component('validar-senha', {
    template: `
    <div style="font-size: 14px;">
        <div class="row" v-if="quantidadeDeCaracteres && senha.length > 0" style="color: #25A048;">
            <i class="fas fa-check-circle" style="position: relative; top: 5px;"></i> 
            <div class="pl-2">
                Conter no mínimo 8 caracteres
            </div>
        </div>
        <div class="row" v-else-if="!quantidadeDeCaracteres && senha.length > 0" style="color: #DC3545;">
            <i class="fas fa-times-circle d-block" style="position: relative; top: 5px;"></i> 
            <div class="pl-2">
                Conter no mínimo 8 caracteres
            </div>
        </div>
        <div class="row" v-else>
            <i class="fas fa-info-circle d-block" style="position: relative; top: 5px; color: #C1C1C1;"></i> 
            <div class="pl-2" style="color: #615757;">
                Conter no mínimo 8 caracteres
            </div>
        </div>
        <div class="row" v-if="contemNumeros && senha.length > 0" style="color: #25A048;">
        <i class="fas fa-check-circle" style="position: relative; top: 5px;" ></i> 
            <div class="pl-2">
                Conter pelo menos 1 número
            </div>
        </div>
        <div class="row" v-else-if="!contemNumeros && senha.length > 0" style="color: #DC3545;">
            <i class="fas fa-times-circle" style="position: relative; top: 5px;"></i>
            <div class="pl-2">
                Conter pelo menos 1 número
            </div>
        </div>
        <div class="row" v-else>
            <i class="fas fa-info-circle" style="position: relative; top: 5px; color: #C1C1C1;"></i>
            <div class="pl-2" style="color: #615757;">
                Conter pelo menos 1 número
            </div>
        </div>
        <div class="row" v-if="contemLetrasMaiusculas && senha.length > 0" style="color: #25A048;">
            <i class="fas fa-check-circle" style="position: relative; top: 5px;"></i> 
            <div class="pl-2">
                Conter pelo menos uma letra maiúscula
            </div>
        </div>
        <div class="row" style="color: #DC3545;" v-else-if="!contemLetrasMaiusculas && senha.length > 0">
            <i class="fas fa-times-circle" style="position: relative; top: 5px;"></i> 
            <div class="pl-2">
                Conter pelo menos uma letra maiúscula
            </div>
        </div>
        <div class="row" v-else>
            <i class="fas fa-info-circle" style="position: relative; top: 5px; color: #C1C1C1;"></i> 
            <div class="pl-2" style="color: #615757;">
                Conter pelo menos uma letra maiúscula
            </div>
        </div>
        <div class="row" style="color: #25A048;" v-if="!possuiSequencia && senha.length > 0">
            <i class="fas fa-check-circle" style="position: relative; top: 5px;"></i> 
            <div class="pl-2">
                Não conter sequência de números ou letras
            </div>
        </div>
        <div class="row" style="color: #DC3545;" v-else-if="possuiSequencia && senha.length > 0">
            <i class="fas fa-times-circle" style="position: relative; top: 5px;"></i> 
            <div class="pl-2">
                Não conter sequência de números ou letras
            </div>
        </div>
        <div class="row" v-else>
            <i class="fas fa-info-circle" style="position: relative; top: 5px; color: #C1C1C1;"></i> 
            <div class="pl-2" style="color: #615757;">
                Não conter sequência de números ou letras
            </div>
        </div>
    </div>
    `,
    props: {
        senha: String,
        senhaValidada: Boolean
    },
    data(){
        return {
            contemNumeros: false,
            contemLetrasMaiusculas: false,
            quantidadeDeCaracteres: false,
            possuiSequencia: false
        }
    },
    methods: {
        validarSenha(senha)
        {
            if(senha.length > 0){
                this.contemNumeros = this.validarNumeros(senha)
                this.contemLetrasMaiusculas = this.validarLetrasMaiusculas(senha)
                this.quantidadeDeCaracteres = this.validarQuantidadeDeCaracteres(senha)
                this.possuiSequencia = this.validarSequenciasDeCaracteres(senha)
                if(this.contemNumeros && this.contemLetrasMaiusculas && this.quantidadeDeCaracteres && !this.possuiSequencia){
                    this.senhaValidada = true
                }else{
                    this.senhaValidada = false
                }
            }
        },
        validarNumeros(senha)
        {
            return /\d/.test(senha)
        },
        validarLetrasMaiusculas(senha)
        {
            return /[A-Z]/.test(senha)
        },
        validarQuantidadeDeCaracteres(senha)
        {
            return senha.length > 7
        },
        validarSequenciasDeCaracteres(senha)
        {
            const letras = 'abcdefghijklmnopqrstuvwxyz'
            const numeros = '0123456789'

            for (let i = 0; i < senha.length - 2; i++) {
                const substring = senha.substring(i, i + 3).toLowerCase()
                if (letras.includes(substring) || numeros.includes(substring)) {
                    return true
                }
            }
            return false
        },
        limparCampos()
        {
            this.contemNumeros = this.contemLetrasMaiusculas = this.quantidadeDeCaracteres = this.possuiSequencia = false
        }
    },
    watch: {
        senha()
        {
            this.senhaValidada = this.senha == '' ? true : false
            this.validarSenha(this.senha)
            this.$emit('senha-validada', this.senhaValidada)
        }

    }
}
)
Vue.component('validar-senha-franquia', {
    template: `
    <div style="font-size: 14px;">
        <div class="d-flex flex-row" v-if="quantidadeDeCaracteres && senha.length > 0" style="color: #25A048; max-height: 30px;">
            <i class="fas fa-check-circle" style="position: relative; top: 3px;"></i> 
            <div style="padding-left: 5px;">
                Conter no mínimo 8 caracteres
            </div>
        </div>
        <div class="d-flex flex-row" v-else-if="!quantidadeDeCaracteres && senha.length > 0" style="color: #DC3545; max-height: 30px;">
            <i class="fas fa-times-circle d-block" style="position: relative; top: 3px;"></i> 
            <div style="padding-left: 5px;">
                Conter no mínimo 8 caracteres
            </div>
        </div>
        <div class="d-flex flex-row" style="max-height: 30px;" v-else>
            <i class="fas fa-info-circle d-block" style="position: relative; top: 3px; color: #C1C1C1;"></i> 
            <div style="color: #615757; padding-left: 5px;">
                Conter no mínimo 8 caracteres
            </div>
        </div>
        <div class="d-flex flex-row" v-if="contemNumeros && senha.length > 0" style="color: #25A048; max-height: 30px;">
        <i class="fas fa-check-circle" style="position: relative; top: 3px;" ></i> 
            <div style="padding-left: 5px;">
                Conter pelo menos 1 número
            </div>
        </div>
        <div class="d-flex flex-row" v-else-if="!contemNumeros && senha.length > 0" style="color: #DC3545; max-height: 30px;">
            <i class="fas fa-times-circle" style="position: relative; top: 3px;"></i>
            <div style="padding-left: 5px;">
                Conter pelo menos 1 número
            </div>
        </div>
        <div class="d-flex flex-row" style="max-height: 30px;" v-else>
            <i class="fas fa-info-circle" style="position: relative; top: 3px; color: #C1C1C1;"></i>
            <div style="color: #615757; padding-left: 5px;">
                Conter pelo menos 1 número
            </div>
        </div>
        <div class="d-flex flex-row" v-if="contemLetrasMaiusculas && senha.length > 0" style="color: #25A048; max-height: 30px;">
            <i class="fas fa-check-circle" style="position: relative; top: 3px;"></i> 
            <div style="padding-left: 5px;">
                Conter pelo menos uma letra maiúscula
            </div>
        </div>
        <div class="d-flex flex-row" style="color: #DC3545; max-height: 30px;" v-else-if="!contemLetrasMaiusculas && senha.length > 0">
            <i class="fas fa-times-circle" style="position: relative; top: 3px;"></i> 
            <div style="padding-left: 5px;">
                Conter pelo menos uma letra maiúscula
            </div>
        </div>
        <div class="d-flex flex-row" style="max-height: 30px;" v-else>
            <i class="fas fa-info-circle" style="position: relative; top: 3px; color: #C1C1C1;"></i> 
            <div style="color: #615757; padding-left: 5px;">
                Conter pelo menos uma letra maiúscula
            </div>
        </div>
        <div class="d-flex flex-row" style="color: #25A048; max-height: 30px;" v-if="!possuiSequencia && senha.length > 0">
            <i class="fas fa-check-circle" style="position: relative; top: 3px;"></i> 
            <div style="padding-left: 5px;">
                Não conter sequência de números ou letras
            </div>
        </div>
        <div class="d-flex flex-row" style="color: #DC3545; max-height: 30px;" v-else-if="possuiSequencia && senha.length > 0">
            <i class="fas fa-times-circle" style="position: relative; top: 3px;"></i> 
            <div style="padding-left: 5px;">
                Não conter sequência de números ou letras
            </div>
        </div>
        <div class="d-flex flex-row" style="max-height: 30px;" v-else>
            <i class="fas fa-info-circle" style="position: relative; top: 3px; color: #C1C1C1;"></i> 
            <div style="color: #615757; padding-left: 5px;">
                Não conter sequência de números ou letras
            </div>
        </div>
    </div>
    `,
    props: {
        senha: String,
        senhaValidada: Boolean
    },
    data(){
        return {
            contemNumeros: false,
            contemLetrasMaiusculas: false,
            quantidadeDeCaracteres: false,
            possuiSequencia: false
        }
    },
    methods: {
        validarSenha(senha)
        {
            if(senha.length > 0){
                this.contemNumeros = this.validarNumeros(senha)
                this.contemLetrasMaiusculas = this.validarLetrasMaiusculas(senha)
                this.quantidadeDeCaracteres = this.validarQuantidadeDeCaracteres(senha)
                this.possuiSequencia = this.validarSequenciasDeCaracteres(senha)
                if(this.contemNumeros && this.contemLetrasMaiusculas && this.quantidadeDeCaracteres && !this.possuiSequencia){
                    this.senhaValidada = true
                }else{
                    this.senhaValidada = false
                }
            }
        },
        validarNumeros(senha)
        {
            return /\d/.test(senha)
        },
        validarLetrasMaiusculas(senha)
        {
            return /[A-Z]/.test(senha)
        },
        validarQuantidadeDeCaracteres(senha)
        {
            return senha.length > 7
        },
        validarSequenciasDeCaracteres(senha)
        {
            const letras = 'abcdefghijklmnopqrstuvwxyz'
            const numeros = '0123456789'

            for (let i = 0; i < senha.length - 2; i++) {
                const substring = senha.substring(i, i + 3).toLowerCase()
                if (letras.includes(substring) || numeros.includes(substring)) {
                    return true
                }
            }
            return false
        },
        limparCampos()
        {
            this.contemNumeros = this.contemLetrasMaiusculas = this.quantidadeDeCaracteres = this.possuiSequencia = false
        }
    },
    watch: {
        senha()
        {
            this.senhaValidada = this.senha == '' ? true : false
            this.validarSenha(this.senha)
            this.$emit('senha-validada', this.senhaValidada)
        }

    }
}
)
