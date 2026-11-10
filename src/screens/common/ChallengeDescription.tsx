type ChallengeDescriptionProps = {
  text?: string | null;
};

// Descripció d'un repte en un desplegable ("Veure la descripció").
export default function ChallengeDescription({
  text,
}: ChallengeDescriptionProps) {
  if (!text) return null;

  return (
    <details className="challenge-description">
      <summary>Veure la descripció</summary>
      <p>{text}</p>
    </details>
  );
}
