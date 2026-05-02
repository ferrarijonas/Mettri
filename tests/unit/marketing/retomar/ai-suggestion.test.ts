import { describe, expect, it } from 'vitest';
import { extractVisibleRetomarMessage } from '../../../../src/modules/marketing/retomar/ai-suggestion';

describe('extractVisibleRetomarMessage', () => {
  it('remove bloco <raciocínio> e mantém só a mensagem final', () => {
    const input = `<raciocínio>[texto interno]</raciocínio>

O aroma do pão saindo do forno está delicioso hoje, Mónica. A fornada já está quase pronta!`;

    expect(extractVisibleRetomarMessage(input)).toBe(
      'O aroma do pão saindo do forno está delicioso hoje, Mónica. A fornada já está quase pronta!',
    );
  });

  it('aceita tag sem acento (<raciocinio>)', () => {
    const input =
      '<raciocinio>[interno]</raciocinio>\nA massa mãe descansou no ponto certo, Mónica. O pão já está ganhando cor.';

    expect(extractVisibleRetomarMessage(input)).toBe(
      'A massa mãe descansou no ponto certo, Mónica. O pão já está ganhando cor.',
    );
  });

  it('mantém texto já limpo', () => {
    const input = 'A casa está com cheiro de pão quente agora, Mónica.';
    expect(extractVisibleRetomarMessage(input)).toBe(input);
  });
});
