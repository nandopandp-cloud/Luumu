import { BarChart3, Layers, MessageCircle, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IllustratedState } from "@/components/ui/IllustratedState";
import { InsightsEmptyArt } from "@/components/illustrations/EmptyArt";

/** Sem respostas suficientes para encontrar padrões. */
export function InsightEmptyState() {
  return (
    <IllustratedState
      className="pt-2"
      wideActions
      art={<InsightsEmptyArt className="w-full" />}
      title="Ainda não há insights por aqui"
      description="Assim que você começar a receber respostas ou dados de interação, nossa IA vai analisar tudo e trazer insights valiosos para o seu produto."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="/surveys" className="w-full justify-center">
            <Sparkles className="size-4" /> Começar a coletar dados
          </Button>
          <Button href="/help?a=insights-ia" variant="ghost" className="w-full justify-center">
            <PlayCircle className="size-4" /> Ver como funciona
          </Button>
        </div>
      }
      steps={[
        { icon: MessageCircle, title: "1. Colete respostas", text: "Receba feedbacks através de pesquisas ou outros canais integrados." },
        { icon: Layers, title: "2. Acumule dados", text: "Quanto mais dados, insights mais completos e precisos." },
        { icon: Sparkles, title: "3. Nossa IA analisa", text: "Identificamos padrões, sentimentos, oportunidades e pontos de atenção." },
        { icon: BarChart3, title: "4. Descubra insights", text: "Veja recomendações práticas para melhorar a experiência dos seus usuários." },
      ]}
    />
  );
}
