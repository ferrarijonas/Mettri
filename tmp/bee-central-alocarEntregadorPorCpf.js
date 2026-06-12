Vue.use(VueMask.VueMaskPlugin)
Vue.component('alocar-por-cpf',{
    template: `
    // template para roteirização
    <div class="form-group column text-left" v-if="roteirizacao">
    <div class="col-form-label">
        Alocar Entregador <i title="Informando o CPF de um entregador, esta entrega será alocada automaticamente para ele. " class="fa fa-info-circle"></i>
    </div>
    <div class="form-group row px-1">
        <div class="w-100 p-2">
            <div class="compartimento-control d-flex flex-column flex-md-row">
                <label for="labelSim" class="mb-0">
                    <input type="radio" id="labelSim" name="adicionarEntregador" v-model="incluirCpfEntregador" value="1">
                    <div class="compartimento-option">
                        <span> Sim </span>
                        <i class="far fa-circle"></i>
                        <i class="fas fa-check-circle"></i>
                    </div>
                </label>
                <label for="labelNao" class="mb-0">
                    <input type="radio" id="labelNao" name="adicionarEntregador" v-model="incluirCpfEntregador" value="0" checked>
                    <div class="compartimento-option">
                        <span> Não </span>
                        <i class="far fa-circle"></i>
                        <i class="fas fa-check-circle"></i>
                    </div>
                </label>
            </div>
        </div>
    </div>
    <div class="form-group col px-0" v-if="incluirCpfEntregador === '1'">
        <label for="cpf_entregador" class="col-form-label">CPF do entregador</label>
        <div>
            <div>
                <input type="text" name="cpf_entregador" id="cpf_entregador" class="form-control" v-model="inputCpf" placeholder="Digite o CPF do entregador" autocomplete="off" required @keyup='validarCpf' @keyup="atualizarCpfInput" v-mask="'###.###.###-##'">
                <div class="position-absolute" style="top: 42px; right: 14px; cursor: pointer;" v-on:click="limparInputCpf()" v-if='Boolean(inputCpf)'>
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div class="text-left px-1 py-2 d-flex flex-row align-items-center bg-white rounded mt-1" v-if="mostarDadosEntregador()" style="overflow: hidden;">
                <div v-if="fotoEntregador">
                    <img :src="fotoLink" width="40px" class="rounded-circle">
                </div>
                <div style="color:#FFCC00;" v-else>
                    <small><i class="fal fa-user"></i></small>
                </div>
                <div class="px-1">
                  <small v-if="Boolean(nomeEntregador)" 
                         v-html="nomeEntregador">
                  </small>
                  <small v-else>
                    Entregador não encontrado
                </small>
                </div>
            </div>
        </div>
    </div>
</div>

// template comum
<div class="form-group column text-sm-right" v-else>
    <div class="form-group row">
        <div class="col-sm-4 col-md-5 col-form-label">
            Alocar Entregador <i title="Informando o CPF de um entregador, esta entrega será alocada automaticamente para ele. " class="fa fa-info-circle"></i>
        </div>
        <div class="col-sm-8 col-md-7">
            <div class="compartimento-control d-flex flex-column flex-md-row">
                <label for="labelSim">
                    <input type="radio" id="labelSim" name="adicionarEntregador" v-model="incluirCpfEntregador" value="1">
                    <div class="compartimento-option">
                        <span> Sim </span>
                        <i class="far fa-circle"></i>
                        <i class="fas fa-check-circle"></i>
                    </div>
                </label>
                <label for="labelNao">
                    <input type="radio" id="labelNao" name="adicionarEntregador" v-model="incluirCpfEntregador" value="0" checked>
                    <div class="compartimento-option">
                        <span> Não </span>
                        <i class="far fa-circle"></i>
                        <i class="fas fa-check-circle"></i>
                    </div>
                </label>
            </div>
        </div>
    </div>
    <div class="form-group row" v-if="incluirCpfEntregador === '1'">
        <label for="cpf_entregador" class="col-sm-4 col-md-5 col-form-label">CPF do entregador</label>
        <div class="col-sm-8 col-md-7">
            <div>
                <input type="text" name="cpf_entregador" id="cpf_entregador" class="form-control" v-model="inputCpf" placeholder="Digite o CPF do entregador" autocomplete="off" required @keyup='validarCpf' @keyup="atualizarCpfInput" v-mask="'###.###.###-##'">
                <div class="position-absolute" style="top: 5px; right: 30px; cursor: pointer;" v-on:click="limparInputCpf()" v-if='Boolean(inputCpf)'>
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div class="text-left px-3 py-2 d-flex flex-row align-items-center bg-white rounded mt-1" v-if="mostarDadosEntregador()">
                <div v-if="fotoEntregador">
                    <img :src="fotoLink" width="40px" class="rounded-circle">
                </div>
                <div style="color:#FFCC00;" v-else>
                    <small style="width: 16px;"><i class="fal fa-user"></i></small>
                </div>
                <div class="px-2">
                  <small v-if="Boolean(nomeEntregador)"
                         v-html="nomeEntregador">
                  </small>
                <small v-else>
                    Entregador não encontrado
                </small>
                </div>

            </div>
            <div class="text-left text-danger" v-if="!cpfValidado">
                <small>O CPF é inválido, tente novamente!</small>
            </div>
        </div>
    </div>
</div>
    `,
    props: {
        cpfEntregador: String,
        entregadorSelecionado: String,
        cpfValidacao: Boolean,
        roteirizacao: Boolean,
        validarExistenciaDoEntregador: Boolean,
        recarregar: Boolean

    },
    data() {
        return {
            cpfValidado: true,
            entregadorExiste: true,
            inputCpf: "",
            incluirCpfEntregador: "0",
            fotoEntregador: "",
            fotoLink: "",
            nomeEntregador: "",
            entregadorSelecionado: ""
        }
    }, 
    methods: {
        validarCpf(){
            regexCpf = /(^\d{3}\.?\d{3}\.?\d{3}\-?\d{2}$)/
            if(Boolean(this.inputCpf)){
                this.cpfValidado = regexCpf.test(this.inputCpf)
            }else{
                this.cpfValidado = true
            }
            this.$emit('cpf-validado', this.cpfValidado)
        },
        atualizarCpfInput() { // serve para retornar o valor do cpf para o elemento pai
            this.$emit('cpf-entregador', this.inputCpf)
        },
        pegarDadosEntregador(cpfEntregador) {
            axios.get('/central/entregas/pegarDadosEntregador', {
                params: {
                    cpfEntregador: cpfEntregador
                }
            }).then((response) => {
                if(!Boolean(response.data)){
                    this.entregadorExiste = false
                    this.nomeEntregador = null
                    this.entregadorSelecionado = {}
                }else{
                    this.fotoEntregador = response.data.foto
                    this.fotoLink = "https://s3.amazonaws.com/media.beedelivery.com.br/fotos/tn-" + this.fotoEntregador
                    this.nomeEntregador = response.data.disponivel == true
                        ? response.data.nome
                        : `${response.data.nome} <span class="badge bg-danger text-white">Indisponível</span>`
                    this.entregadorSelecionado = {'id': response.data.id, 'status': response.data.status, 'nome': response.data.nome, 'img': this.fotoLink, 'bloqueio_invisvel' : response.data.sn_bloqueio_invisivel}
                    this.entregadorExiste = true
                }
                this.$emit('entregador-selecionado', this.entregadorSelecionado)
                this.$emit('entregador-existe', this.entregadorExiste)
            }).catch((error) => {
                console.log(error)
            })
        },
        mostarDadosEntregador() {
             if(this.cpfValidado && this.inputCpf.length == 14){
                this.pegarDadosEntregador(this.inputCpf)
                return true
             }else{
                this.entregadorSelecionado = ""
                this.$emit('entregador-selecionado', this.entregadorSelecionado)
                this.$emit('entregador-existe', true)
                return false;
             }
        },
        limparInputCpf() {
            this.inputCpf = ""
            this.entregadorSelecionado = null
            this.entregadorExiste = true
            this.cpfValidado = true
            this.$emit('entregador-existe', this.entregadorExiste)
            this.$emit('entregador-selecionado', this.entregadorSelecionado)
            this.atualizarCpfInput()
        }
    },
    watch: {
        'incluirCpfEntregador': function (){
            if(this.incluirCpfEntregador == 0){
                this.limparInputCpf()
            }
        },
        'recarregar': function (){
            this.incluirCpfEntregador = '0'
        }
    }
})