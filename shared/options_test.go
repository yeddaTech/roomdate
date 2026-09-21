package shared

import (
	"slices"
	"testing"
)

func TestOptionsLoaded(t *testing.T) {
	if len(Cities) < 100 || len(Occupations) != 3 || len(LifestyleTags) != 6 || len(Amenities) != 10 || len(ReportReasons) != 6 {
		t.Fatalf("elenchi = %d città, %d occupazioni, %d abitudini, %d servizi, %d motivi di segnalazione",
			len(Cities), len(Occupations), len(LifestyleTags), len(Amenities), len(ReportReasons))
	}
	if !IsCity("Milano") || !IsCity("L'Aquila") || IsCity("milano") || IsCity("") {
		t.Error("IsCity deve accettare solo i nomi esatti dell'elenco")
	}
}

// Chiavi e nomi non devono ripetersi, altrimenti select e filtri del frontend mostrano doppioni.
func TestOptionsUnique(t *testing.T) {
	if !slices.IsSorted(Cities) {
		t.Error("le città vanno in ordine alfabetico")
	}
	seen := map[string]bool{}
	for _, c := range Cities {
		if seen[c] {
			t.Errorf("città ripetuta: %s", c)
		}
		seen[c] = true
	}
	for name, options := range map[string][]Option{"occupations": Occupations, "lifestyleTags": LifestyleTags, "amenities": Amenities, "reportReasons": ReportReasons} {
		keys := map[string]bool{}
		for _, o := range options {
			if o.Key == "" || o.Label == "" || keys[o.Key] {
				t.Errorf("%s: opzione non valida o ripetuta: %+v", name, o)
			}
			keys[o.Key] = true
		}
	}
}

func TestNormalizeKeys(t *testing.T) {
	out, ok := NormalizeKeys(LifestyleTags, []string{"socievole", "non_fumatore", "socievole"})
	if !ok || !slices.Equal(out, []string{"non_fumatore", "socievole"}) {
		t.Errorf("NormalizeKeys = %v, %v", out, ok)
	}
	if out, ok := NormalizeKeys(LifestyleTags, nil); !ok || out == nil || len(out) != 0 {
		t.Errorf("elenco vuoto = %#v, %v", out, ok)
	}
	if _, ok := NormalizeKeys(LifestyleTags, []string{"socievole", "Socievole"}); ok {
		t.Error("una chiave sconosciuta va rifiutata")
	}
}
