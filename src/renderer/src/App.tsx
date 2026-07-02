// Wisp — © Shawy404. All rights reserved.
export default function App(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <div className="drag-region flex h-9 items-center justify-center border-b border-neutral-800 text-xs text-neutral-500">
        Wisp — gezinmek dağılmak değil, haritalamak olsun
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-semibold tracking-tight text-accent">Wisp</div>
          <div className="mt-2 text-sm text-neutral-400">Faz 0 iskeleti — oda sistemi geliyor</div>
        </div>
      </div>
    </div>
  )
}
