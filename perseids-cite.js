var PerseidsCite;

PerseidsCite = PerseidsCite || {};

PerseidsCite.get_collection = function() {
	var coll = $("#cite_selector option:selected").val();
	$("#cite_frame").attr("src",coll);
	return true;
};
