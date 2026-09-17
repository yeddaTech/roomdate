package users

import (
	"slices"

	"roomdate-backend/shared"
)

// Chiavi delle abitudini sul fumo (shared/options.json): si escludono a vicenda.
const (
	tagSmoker    = "fumatore"
	tagNonSmoker = "non_fumatore"
)

// similarBudgetRange è la differenza massima, in euro, tra due budget considerati simili.
const similarBudgetRange = 100

// Compatibility spiega cosa hanno in comune chi guarda e un altro profilo. Non è un punteggio:
// ogni voce è un fatto che entrambi hanno indicato, così il frontend può mostrarne il motivo.
type Compatibility struct {
	// SameCity: entrambi hanno indicato la stessa città.
	SameCity bool `json:"sameCity"`
	// SimilarBudget: entrambi hanno un budget, e differiscono al massimo di similarBudgetRange euro.
	SimilarBudget bool `json:"similarBudget"`
	// SharedTags: abitudini indicate da entrambi, nell'ordine dell'elenco.
	SharedTags []string `json:"sharedTags"`
	// SmokingMismatch: uno ha indicato "Fumatore" e l'altro "Non fumatore".
	SmokingMismatch bool `json:"smokingMismatch"`
}

// profileFacts sono i dati di un profilo usati per il confronto.
type profileFacts struct {
	City          string
	BudgetMax     int
	LifestyleTags []string
}

func compare(a, b profileFacts) Compatibility {
	c := Compatibility{
		SameCity:      a.City != "" && a.City == b.City,
		SimilarBudget: a.BudgetMax > 0 && b.BudgetMax > 0 && abs(a.BudgetMax-b.BudgetMax) <= similarBudgetRange,
		SharedTags:    []string{},
	}
	for _, tag := range shared.LifestyleTags {
		if slices.Contains(a.LifestyleTags, tag.Key) && slices.Contains(b.LifestyleTags, tag.Key) {
			c.SharedTags = append(c.SharedTags, tag.Key)
		}
	}
	smokes := func(tags []string) (yes, no bool) {
		return slices.Contains(tags, tagSmoker), slices.Contains(tags, tagNonSmoker)
	}
	aYes, aNo := smokes(a.LifestyleTags)
	bYes, bNo := smokes(b.LifestyleTags)
	c.SmokingMismatch = (aYes && bNo) || (aNo && bYes)
	return c
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
