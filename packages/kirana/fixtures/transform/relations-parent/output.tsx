

const group = {"name": "field-group", "anchor": "krEKOt"}

// shadcn/ui's FieldGroup: a group directly inside another is tighter (`*:data-[slot=field-group]:gap-4`).
const styles = {
  group: "krEKOt kJ_ip70 kJ-0gNr_iExv",
  // `*:w-full`: the group's children, not its grandchildren.
  child: "kaF-0gNr_yp7g k87-t3NK_FaDM",
}

export function Good() {
  return (
    <div className="krEKOt kJ_ip70 kJ-0gNr_iExv">
      <label className="kaF-0gNr_yp7g k87-t3NK_FaDM" />
      <div className="krEKOt kJ_ip70 kJ-0gNr_iExv" />
    </div>
  )
}

export function Bad() {
  return (
    <div className="krEKOt">
      <span>
        <label className="kaF-0gNr_yp7g k87-t3NK_FaDM" />
      </span>
    </div>
  )
}
