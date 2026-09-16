package listings

// Amenities sono i servizi che un annuncio può indicare, nell'ordine in cui vengono mostrati.
// Le etichette in italiano stanno nel frontend (src/api/listings.ts): le due liste vanno tenute allineate.
var Amenities = []string{
	"wifi",
	"arredata",
	"lavatrice",
	"lavastoviglie",
	"aria_condizionata",
	"riscaldamento",
	"balcone",
	"ascensore",
	"bagno_privato",
	"animali_ammessi",
}

// normalizeAmenities elimina i duplicati e ordina i servizi come in Amenities.
// ok è false se c'è un servizio sconosciuto.
func normalizeAmenities(in []string) (out []string, ok bool) {
	selected := make(map[string]bool, len(in))
	for _, a := range in {
		selected[a] = true
	}
	out = []string{}
	for _, a := range Amenities {
		if selected[a] {
			out = append(out, a)
			delete(selected, a)
		}
	}
	return out, len(selected) == 0
}
